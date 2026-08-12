import { isWorkspaceAdmin, WORKSPACE_ID } from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";

type JsonObject = Record<string, unknown>;

@Injectable()
export class PaperclipService {
	private readonly url: string;
	private readonly token?: string;
	private readonly companyId?: string;
	private readonly operationsAgentId?: string;
	constructor(
		@InjectDatabase() private readonly db: Db,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.url = (
			config.get("PAPERCLIP_URL", { infer: true }) ?? "http://127.0.0.1:3100"
		).replace(/\/$/, "");
		this.token = config.get("PAPERCLIP_API_TOKEN", { infer: true });
		this.companyId = config.get("PAPERCLIP_COMPANY_ID", { infer: true });
		this.operationsAgentId = config.get("PAPERCLIP_OPERATIONS_AGENT_ID", {
			infer: true,
		});
	}

	async dashboard() {
		await this.flush();
		try {
			const companyId = await this.resolveCompanyId();
			const [agents, approvals, activity, issues, routines] = await Promise.all(
				[
					this.request(`/api/companies/${companyId}/agents`),
					this.request(`/api/companies/${companyId}/approvals`),
					this.request(`/api/companies/${companyId}/activity?limit=50`),
					this.request(`/api/companies/${companyId}/issues?view=compact`),
					this.request(`/api/companies/${companyId}/routines`),
				],
			);
			const payload = {
				connected: true,
				companyId,
				agents,
				approvals,
				activity,
				issues,
				routines,
				syncedAt: new Date().toISOString(),
			};
			await this.db.paperclipSnapshot.upsert({
				where: { key: "dashboard" },
				create: {
					key: "dashboard",
					payload: payload as unknown as Prisma.InputJsonValue,
				},
				update: {
					payload: payload as unknown as Prisma.InputJsonValue,
					fetchedAt: new Date(),
				},
			});
			return { ...payload, queued: await this.pendingCount() };
		} catch (error) {
			const cached = await this.db.paperclipSnapshot.findUnique({
				where: { key: "dashboard" },
			});
			const snapshot = (cached?.payload as JsonObject | undefined) ?? {};
			const bridgeIsFresh = cached
				? Date.now() - cached.fetchedAt.getTime() < 30_000
				: false;
			return {
				companyId:
					typeof snapshot.companyId === "string" ? snapshot.companyId : "",
				agents: snapshot.agents ?? [],
				approvals: snapshot.approvals ?? [],
				activity: snapshot.activity ?? [],
				issues: snapshot.issues ?? [],
				routines: snapshot.routines ?? [],
				syncedAt:
					typeof snapshot.syncedAt === "string" ? snapshot.syncedAt : "",
				connected: bridgeIsFresh,
				error: error instanceof Error ? error.message : "Paperclip unavailable",
				queued: await this.pendingCount(),
				cachedAt: cached?.fetchedAt.toISOString() ?? null,
			};
		}
	}

	async bridgeSnapshot(payload: JsonObject) {
		const snapshot = {
			...payload,
			connected: true,
			syncedAt: new Date().toISOString(),
		};
		await this.db.paperclipSnapshot.upsert({
			where: { key: "dashboard" },
			create: {
				key: "dashboard",
				payload: snapshot as unknown as Prisma.InputJsonValue,
			},
			update: {
				payload: snapshot as unknown as Prisma.InputJsonValue,
				fetchedAt: new Date(),
			},
		});
		return { ok: true };
	}

	bridgeOutbox() {
		return this.db.paperclipOutbox.findMany({
			where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
			orderBy: { createdAt: "asc" },
			take: 30,
			select: { id: true, kind: true, targetId: true, payload: true },
		});
	}

	async bridgeComplete(id: string, error?: string) {
		if (error) {
			await this.db.paperclipOutbox.update({
				where: { id },
				data: {
					attempts: { increment: 1 },
					lastError: error.slice(0, 1000),
					nextAttemptAt: new Date(Date.now() + 60_000),
				},
			});
		} else {
			await this.db.paperclipOutbox.update({
				where: { id },
				data: { status: "SENT", attempts: { increment: 1 }, lastError: null },
			});
		}
		return { ok: true };
	}

	async teamAgents() {
		const dashboard = await this.dashboard();
		const agents = Array.isArray(dashboard.agents)
			? (dashboard.agents as JsonObject[])
			: [];
		return agents.map((agent) => ({
			id: `paperclip:${String(agent.id)}`,
			name: String(agent.name ?? "Paperclip agent"),
			description:
				typeof agent.capabilities === "string" ? agent.capabilities : null,
			status: String(agent.status ?? "idle").toUpperCase(),
			createdAt: String(agent.createdAt ?? new Date().toISOString()),
			updatedAt: String(agent.updatedAt ?? new Date().toISOString()),
			createdBy: { id: "paperclip", name: "Paperclip", image: null },
			currentVersion: null,
			triggers: [],
			runCount: 0,
			source: "paperclip" as const,
			title: agent.title,
			role: agent.role,
		}));
	}

	async agent(agentId: string) {
		const [agent, dashboard] = await Promise.all([
			this.safeRequest(`/api/agents/${agentId}`),
			this.dashboard(),
		]);
		return {
			connected: dashboard.connected,
			agent,
			activity: Array.isArray(dashboard.activity)
				? (dashboard.activity as JsonObject[])
						.filter((item) => item.agentId === agentId)
						.slice(0, 30)
				: [],
			approvals: Array.isArray(dashboard.approvals)
				? (dashboard.approvals as JsonObject[]).filter(
						(item) =>
							item.requestedByAgentId === agentId ||
							(item.payload as JsonObject | undefined)?.agentId === agentId,
					)
				: [],
			routines: dashboard.routines ?? [],
			queued: dashboard.queued,
		};
	}

	async instruction(agentId: string, message: string, userId: string) {
		return this.enqueueAndSend("instruction", agentId, { message }, userId);
	}
	async approval(
		approvalId: string,
		action: string,
		note: string | undefined,
		userId: string,
	) {
		return this.enqueueAndSend(
			"approval",
			approvalId,
			{ action, note },
			userId,
		);
	}
	async workflow(routineId: string, payload: JsonObject, userId: string) {
		return this.enqueueAndSend("workflow", routineId, payload, userId);
	}

	async automation(kind: string, payload: JsonObject, userId = "system") {
		if (!this.operationsAgentId) return { configured: false, queued: false };
		const result = await this.enqueueAndSend(
			"automation",
			this.operationsAgentId,
			{ kind, ...payload },
			userId,
		);
		return { configured: true, queued: true, ...result };
	}

	async sync() {
		const flushed = await this.flush(true);
		return { flushed, dashboard: await this.dashboard() };
	}

	async authorize(userId: string, admin = false) {
		const member = await this.db.member.findUnique({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId },
			},
			select: { role: true },
		});
		if (!member || (admin && !isWorkspaceAdmin(member.role as never))) {
			throw new ForbiddenException(
				admin
					? "Only an owner or admin can approve or trigger agent workflows."
					: "CRM staff access is required.",
			);
		}
	}

	private async enqueueAndSend(
		kind: string,
		targetId: string,
		payload: JsonObject,
		userId: string,
	) {
		const row = await this.db.paperclipOutbox.create({
			data: {
				kind,
				targetId,
				payload: payload as Prisma.InputJsonValue,
				createdById: userId,
			},
		});
		const sent = await this.deliver(row.id).catch(() => false);
		return { id: row.id, status: sent ? "SENT" : "PENDING", offline: !sent };
	}

	private async flush(force = false) {
		const rows = await this.db.paperclipOutbox.findMany({
			where: {
				status: "PENDING",
				...(force ? {} : { nextAttemptAt: { lte: new Date() } }),
			},
			orderBy: { createdAt: "asc" },
			take: 30,
			select: { id: true },
		});
		let sent = 0;
		for (const row of rows)
			if (await this.deliver(row.id).catch(() => false)) sent += 1;
		return sent;
	}

	private async deliver(id: string) {
		const row = await this.db.paperclipOutbox.findUnique({ where: { id } });
		if (!row || row.status !== "PENDING") return false;
		try {
			const payload = row.payload as JsonObject;
			if (row.kind === "instruction" || row.kind === "automation")
				await this.request(`/api/agents/${row.targetId}/wakeup`, {
					method: "POST",
					body: {
						source: "on_demand",
						triggerDetail:
							row.kind === "automation" ? "platform-operations" : "manual",
						reason: String(
							payload.message ?? payload.kind ?? "CRM automation event",
						),
						payload:
							row.kind === "automation"
								? { ...payload, source: "vayu-crm" }
								: { instruction: payload.message, source: "vayu-crm" },
						idempotencyKey: row.id,
					},
				});
			else if (row.kind === "approval")
				await this.request(
					`/api/approvals/${row.targetId}/${String(payload.action)}`,
					{ method: "POST", body: { decisionNote: payload.note ?? null } },
				);
			else if (row.kind === "workflow")
				await this.request(`/api/routines/${row.targetId}/run`, {
					method: "POST",
					body: payload,
				});
			await this.db.paperclipOutbox.update({
				where: { id },
				data: { status: "SENT", attempts: { increment: 1 }, lastError: null },
			});
			return true;
		} catch (error) {
			await this.db.paperclipOutbox.update({
				where: { id },
				data: {
					attempts: { increment: 1 },
					lastError: error instanceof Error ? error.message : "Delivery failed",
					nextAttemptAt: new Date(Date.now() + 60_000),
				},
			});
			return false;
		}
	}

	private async resolveCompanyId() {
		if (this.companyId) return this.companyId;
		const companies = await this.request("/api/companies");
		const first = Array.isArray(companies) ? companies[0] : companies;
		const id = (first as JsonObject | undefined)?.id;
		if (typeof id !== "string")
			throw new Error("No Paperclip company is configured.");
		return id;
	}
	private pendingCount() {
		return this.db.paperclipOutbox.count({ where: { status: "PENDING" } });
	}
	private safeRequest(path: string) {
		return this.request(path).catch(() => null);
	}
	private async request(
		path: string,
		options?: { method?: string; body?: unknown },
	) {
		const response = await fetch(`${this.url}${path}`, {
			method: options?.method ?? "GET",
			headers: {
				Accept: "application/json",
				...(options?.body ? { "Content-Type": "application/json" } : {}),
				...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
			},
			body: options?.body ? JSON.stringify(options.body) : undefined,
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) throw new Error(`Paperclip returned ${response.status}.`);
		return response.json() as Promise<unknown>;
	}
}
