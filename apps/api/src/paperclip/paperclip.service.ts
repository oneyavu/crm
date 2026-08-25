import { createHash } from "node:crypto";
import { isWorkspaceAdmin, WORKSPACE_ID } from "@crm/auth";
import { ActivityType, type Db, type Prisma, RecordSource } from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";

type JsonObject = Record<string, unknown>;

type BridgeCrmContact = {
	firstName: string;
	lastName?: string | null;
	email: string;
	title?: string | null;
	phone?: string | null;
	primary?: boolean;
};

type BridgeCrmActivity = {
	type: "EMAIL" | "MEETING" | "NOTE" | "TASK";
	subject: string;
	body?: string | null;
	occurredAt?: string | null;
	dueAt?: string | null;
	completedAt?: string | null;
	contactEmail?: string | null;
};

type BridgeCrmAccountUpdate = {
	externalKey: string;
	company: {
		name: string;
		domain?: string | null;
		website?: string | null;
		industry?: string | null;
		phone?: string | null;
		email?: string | null;
		description?: string | null;
	};
	contacts?: BridgeCrmContact[];
	activities?: BridgeCrmActivity[];
};

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

	async bridgeCrmAccountUpdate(input: BridgeCrmAccountUpdate) {
		const externalKey = input.externalKey?.trim();
		const companyName = input.company?.name?.trim();
		if (!externalKey || !companyName) {
			throw new BadRequestException(
				"External key and company name are required.",
			);
		}

		const domain = input.company.domain?.trim().toLowerCase() || null;
		const owner = await this.db.user.findFirst({
			orderBy: { createdAt: "asc" },
			select: { id: true },
		});
		if (!owner) throw new BadRequestException("CRM has no record owner.");

		const company = await this.db.$transaction(async (tx) => {
			const existing = domain
				? await tx.company.findUnique({ where: { domain } })
				: await tx.company.findFirst({
						where: { name: { equals: companyName, mode: "insensitive" } },
					});
			const company = existing
				? await tx.company.update({
						where: { id: existing.id },
						data: {
							name: companyName,
							domain: domain ?? existing.domain,
							website: input.company.website ?? existing.website,
							industry: input.company.industry ?? existing.industry,
							phone: input.company.phone ?? existing.phone,
							email: input.company.email ?? existing.email,
							description: input.company.description ?? existing.description,
						},
					})
				: await tx.company.create({
						data: {
							name: companyName,
							domain,
							website: input.company.website ?? null,
							industry: input.company.industry ?? null,
							phone: input.company.phone ?? null,
							email: input.company.email ?? null,
							description: input.company.description ?? null,
							ownerId: owner.id,
							source: RecordSource.EMAIL,
						},
					});

			const contacts = new Map<string, string>();
			for (const candidate of input.contacts ?? []) {
				const email = candidate.email.trim().toLowerCase();
				if (!email || !candidate.firstName.trim()) continue;
				const existingContact = await tx.contact.findUnique({
					where: { email },
				});
				if (
					existingContact?.companyId &&
					existingContact.companyId !== company.id
				) {
					throw new BadRequestException(
						`Contact ${email} already belongs to another company.`,
					);
				}
				const contact = await tx.contact.upsert({
					where: { email },
					create: {
						firstName: candidate.firstName.trim(),
						lastName: candidate.lastName?.trim() || null,
						email,
						title: candidate.title?.trim() || null,
						phone: candidate.phone?.trim() || null,
						companyId: company.id,
						ownerId: owner.id,
						source: RecordSource.EMAIL,
					},
					update: {
						firstName: candidate.firstName.trim(),
						lastName: candidate.lastName?.trim() || undefined,
						title: candidate.title?.trim() || undefined,
						phone: candidate.phone?.trim() || undefined,
						companyId: company.id,
					},
				});
				contacts.set(email, contact.id);
				if (candidate.primary) {
					await tx.company.update({
						where: { id: company.id },
						data: { primaryContactId: contact.id },
					});
				}
			}

			let activitiesWritten = 0;
			for (const [index, activity] of (input.activities ?? []).entries()) {
				const activityKey = `${externalKey}:${index}`;
				const duplicate = await tx.activity.findFirst({
					where: {
						companyId: company.id,
						meta: { path: ["externalKey"], equals: activityKey },
					},
					select: { id: true },
				});
				if (duplicate) continue;
				const contactId = activity.contactEmail
					? (contacts.get(activity.contactEmail.toLowerCase()) ?? null)
					: null;
				await tx.activity.create({
					data: {
						type: ActivityType[activity.type],
						subject: activity.subject.trim(),
						body: activity.body?.trim() || null,
						occurredAt: activity.occurredAt
							? new Date(activity.occurredAt)
							: null,
						dueAt: activity.dueAt ? new Date(activity.dueAt) : null,
						completedAt: activity.completedAt
							? new Date(activity.completedAt)
							: null,
						companyId: company.id,
						contactId,
						createdById: owner.id,
						meta: {
							externalKey: activityKey,
							source: "gmail-reconciliation",
						},
					},
				});
				activitiesWritten += 1;
			}

			const latest = (input.activities ?? [])
				.map((activity) => activity.occurredAt)
				.filter((value): value is string => Boolean(value))
				.map((value) => new Date(value))
				.sort((a, b) => b.getTime() - a.getTime())[0];
			if (latest) {
				await tx.company.update({
					where: { id: company.id },
					data: { lastActivityAt: latest },
				});
			}

			return {
				id: company.id,
				name: company.name,
				contactsMatched: contacts.size,
				activitiesWritten,
			};
		});

		return { ok: true, company };
	}

	async bridgeSalesSnapshot() {
		const [
			companies,
			contacts,
			dealsRaw,
			activities,
			inquiries,
			projects,
			invoicesRaw,
			businessRecordsRaw,
			milestones,
			catalogItems,
		] = await Promise.all([
			this.db.company.findMany({
				orderBy: { updatedAt: "desc" },
				take: 500,
				select: {
					id: true,
					name: true,
					domain: true,
					website: true,
					industry: true,
					ownerId: true,
					primaryContactId: true,
					source: true,
					lastActivityAt: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.contact.findMany({
				orderBy: { updatedAt: "desc" },
				take: 1000,
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					title: true,
					companyId: true,
					ownerId: true,
					source: true,
					lastActivityAt: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.deal.findMany({
				orderBy: { updatedAt: "desc" },
				take: 1000,
				select: {
					id: true,
					name: true,
					companyId: true,
					ownerId: true,
					stage: true,
					amount: true,
					currency: true,
					baseAmount: true,
					baseCurrency: true,
					expectedCloseDate: true,
					closedAt: true,
					lastActivityAt: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.activity.findMany({
				orderBy: { updatedAt: "desc" },
				take: 500,
				select: {
					id: true,
					type: true,
					subject: true,
					occurredAt: true,
					dueAt: true,
					completedAt: true,
					companyId: true,
					contactId: true,
					dealId: true,
					createdById: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.inquiry.findMany({
				orderBy: { updatedAt: "desc" },
				take: 500,
				select: {
					id: true,
					reference: true,
					source: true,
					status: true,
					organizationName: true,
					contactName: true,
					email: true,
					website: true,
					challenge: true,
					desiredOutcome: true,
					timeline: true,
					investment: true,
					companyId: true,
					contactId: true,
					dealId: true,
					assignedToId: true,
					priority: true,
					score: true,
					triageSummary: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.project.findMany({
				orderBy: { updatedAt: "desc" },
				take: 500,
				select: {
					id: true,
					name: true,
					status: true,
					companyId: true,
					ownerId: true,
					startDate: true,
					dueDate: true,
					budget: true,
					currency: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.invoice.findMany({
				orderBy: { updatedAt: "desc" },
				take: 500,
				select: {
					id: true,
					number: true,
					status: true,
					companyId: true,
					projectId: true,
					issueDate: true,
					dueDate: true,
					currency: true,
					total: true,
					amountPaid: true,
					sentAt: true,
					paidAt: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.businessRecord.findMany({
				orderBy: { updatedAt: "desc" },
				take: 1000,
				select: {
					id: true,
					type: true,
					reference: true,
					title: true,
					status: true,
					amount: true,
					currency: true,
					occurredAt: true,
					dueAt: true,
					companyId: true,
					contactId: true,
					projectId: true,
					invoiceId: true,
					includedInFinancials: true,
					billable: true,
					clientVisible: true,
					expenseScope: true,
					categoryId: true,
					financialAccountId: true,
					source: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.projectMilestone.findMany({
				orderBy: { updatedAt: "desc" },
				take: 1000,
				select: {
					id: true,
					projectId: true,
					title: true,
					description: true,
					dueDate: true,
					completedAt: true,
					position: true,
					clientVisible: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
			this.db.catalogItem.findMany({
				where: { active: true },
				orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
				take: 500,
				select: {
					id: true,
					code: true,
					name: true,
					kind: true,
					category: true,
					summary: true,
					investmentPath: true,
					sourceUrl: true,
					position: true,
					active: true,
					createdAt: true,
					updatedAt: true,
				},
			}),
		]);
		const deals = dealsRaw.map((deal) => ({
			...deal,
			amount: deal.amount?.toString() ?? null,
			baseAmount: deal.baseAmount?.toString() ?? null,
		}));
		const projectsNormalized = projects.map((project) => ({
			...project,
			budget: project.budget?.toString() ?? null,
		}));
		const invoices = invoicesRaw.map((invoice) => ({
			...invoice,
			total: invoice.total.toString(),
			amountPaid: invoice.amountPaid.toString(),
		}));
		const businessRecords = businessRecordsRaw.map((record) => ({
			...record,
			amount: record.amount?.toString() ?? null,
		}));
		const openDeals = deals.filter(
			(deal) => deal.stage !== "CLOSED_WON" && deal.stage !== "CLOSED_LOST",
		);
		const pipelineByCurrency = Object.entries(
			openDeals.reduce<Record<string, number>>((totals, deal) => {
				if (deal.amount)
					totals[deal.currency] =
						(totals[deal.currency] ?? 0) + Number(deal.amount);
				return totals;
			}, {}),
		).map(([currency, amount]) => ({ currency, amount: String(amount) }));
		const latest =
			[
				...companies,
				...contacts,
				...deals,
				...activities,
				...inquiries,
				...projectsNormalized,
				...invoices,
				...businessRecords,
				...milestones,
				...catalogItems,
			]
				.map((row) => row.updatedAt.toISOString())
				.sort()
				.at(-1) ?? new Date(0).toISOString();
		const revision = createHash("sha256")
			.update(
				JSON.stringify({
					latest,
					companies: companies.length,
					contacts: contacts.length,
					deals: deals.length,
					activities: activities.length,
					inquiries: inquiries.length,
					projects: projects.length,
					invoices: invoices.length,
					businessRecords: businessRecords.length,
					milestones: milestones.length,
					catalogItems: catalogItems.length,
				}),
			)
			.digest("hex");
		const primaryPipeline =
			pipelineByCurrency.length === 1 ? pipelineByCurrency[0] : null;
		return {
			schemaVersion: 1,
			objective: {
				key: "sell-v-os",
				title: "Sell V-OS to as many customers as possible",
				offer: "V-OS",
				operatingPriority:
					"Convert qualified demand into recurring V-OS customers while preserving delivery quality and evidence.",
			},
			revision,
			generatedAt: new Date().toISOString(),
			metrics: {
				companies: companies.length,
				contacts: contacts.length,
				openDeals: openDeals.length,
				wonDeals: deals.filter((deal) => deal.stage === "CLOSED_WON").length,
				activeInquiries: inquiries.filter(
					(inquiry) =>
						inquiry.status !== "CLOSED" &&
						inquiry.status !== "SPAM" &&
						inquiry.status !== "CONVERTED",
				).length,
				pipelineValue: primaryPipeline?.amount ?? null,
				currency: primaryPipeline?.currency ?? null,
				pipelineByCurrency,
			},
			companies,
			contacts,
			deals,
			activities,
			inquiries,
			projects: projectsNormalized,
			invoices,
			businessRecords,
			milestones,
			catalogItems,
		};
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
		if (row?.status !== "PENDING") return false;
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
