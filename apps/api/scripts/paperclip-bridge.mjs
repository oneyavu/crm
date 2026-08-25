import { createHmac } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	newRows,
	updatedRows,
	websiteInquiryEvent,
	websiteInquiryTelegramSummary,
	websiteInquiryUpdatedEvent,
	websiteInquiryUpdateTelegramSummary,
} from "./paperclip-bridge-events.mjs";

const crmUrl = (
	process.env.CRM_API_URL || "https://api.asina.onevayu.com"
).replace(/\/$/, "");
const paperclipUrl = (
	process.env.PAPERCLIP_URL || "http://127.0.0.1:3100"
).replace(/\/$/, "");
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const secret = process.env.PAPERCLIP_BRIDGE_SECRET;
const unifiedSnapshotPath =
	process.env.VAYU_UNIFIED_SNAPSHOT ||
	"C:/VAYU_LOCAL_OPS/sync/unified-snapshot.json";
const operationsAgentId = process.env.PAPERCLIP_OPERATIONS_AGENT_ID;
const agentCoreBridgePath =
	process.env.AGENT_CORE_BRIDGE_CONFIG ||
	"C:/VAYU_LOCAL_OPS/sync/agent-core-bridge.json";

if (!companyId || !secret)
	throw new Error("Paperclip bridge configuration is incomplete.");

const authHeaders = {
	Authorization: `Bearer ${secret}`,
	"Content-Type": "application/json",
};

async function json(url, options = {}) {
	const response = await fetch(url, {
		...options,
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok)
		throw new Error(`${response.status} ${response.statusText}`);
	return response.json();
}

async function snapshot() {
	const [agents, approvals, activity, issues, routines] = await Promise.all([
		json(`${paperclipUrl}/api/companies/${companyId}/agents`),
		json(`${paperclipUrl}/api/companies/${companyId}/approvals`),
		json(`${paperclipUrl}/api/companies/${companyId}/activity?limit=50`),
		json(`${paperclipUrl}/api/companies/${companyId}/issues?view=compact`),
		json(`${paperclipUrl}/api/companies/${companyId}/routines`),
	]);
	const crmSnapshot = {
		companyId,
		agents: agents.map(
			({
				id,
				name,
				role,
				title,
				icon,
				status,
				reportsTo,
				lastHeartbeatAt,
				updatedAt,
			}) => ({
				id,
				name,
				role,
				title,
				icon,
				status,
				reportsTo,
				lastHeartbeatAt,
				updatedAt,
			}),
		),
		approvals: approvals.map(
			({ id, type, status, requestedByAgentId, createdAt, updatedAt }) => ({
				id,
				type,
				status,
				requestedByAgentId,
				createdAt,
				updatedAt,
			}),
		),
		activity: activity.map(
			({ id, action, entityType, entityId, agentId, createdAt }) => ({
				id,
				action,
				entityType,
				entityId,
				agentId,
				createdAt,
			}),
		),
		issues: issues.map(
			({
				id,
				identifier,
				title,
				status,
				priority,
				assigneeAgentId,
				projectId,
				goalId,
				updatedAt,
			}) => ({
				id,
				identifier,
				title,
				status,
				priority,
				assigneeAgentId,
				projectId,
				goalId,
				updatedAt,
			}),
		),
		routines: routines.map(
			({ id, title, status, assigneeAgentId, priority, updatedAt }) => ({
				id,
				title,
				status,
				assigneeAgentId,
				priority,
				updatedAt,
			}),
		),
	};
	try {
		await json(`${crmUrl}/internal/paperclip/bridge/snapshot`, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify(crmSnapshot),
		});
	} catch (error) {
		console.error(
			new Date().toISOString(),
			"Paperclip CRM snapshot synchronization failed",
			error,
		);
	}
	try {
		await synchronizeSales({ agents, approvals, activity, issues, routines });
	} catch (error) {
		console.error(
			new Date().toISOString(),
			"Unified sales synchronization failed",
			error,
		);
	}
}

async function readUnifiedSnapshot() {
	try {
		return JSON.parse(await readFile(unifiedSnapshotPath, "utf8"));
	} catch {
		return null;
	}
}

function changedRows(previous, current, fields) {
	const before = new Map(
		(previous || []).map((row) => [row.id, row.updatedAt]),
	);
	return (current || [])
		.filter((row) => before.get(row.id) !== row.updatedAt)
		.slice(0, 20)
		.map((row) =>
			Object.fromEntries(fields.map((field) => [field, row[field] ?? null])),
		);
}

async function writeUnifiedSnapshot(value) {
	await mkdir(path.dirname(unifiedSnapshotPath), { recursive: true });
	const temporary = `${unifiedSnapshotPath}.${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	await rename(temporary, unifiedSnapshotPath);
}

async function notifySalesAgent(previous, crm, agents) {
	if (!previous?.crm?.revision || previous.crm.revision === crm.revision)
		return;
	const agent = operationsAgentId
		? { id: operationsAgentId }
		: agents.find((item) => item.name === "Revenue Operations Agent") ||
			agents.find((item) => item.name === "ASINA Executive");
	if (!agent?.id) return;
	const changes = {
		companies: changedRows(previous.crm.companies, crm.companies, [
			"id",
			"name",
			"updatedAt",
		]),
		contacts: changedRows(previous.crm.contacts, crm.contacts, [
			"id",
			"companyId",
			"updatedAt",
		]),
		deals: changedRows(previous.crm.deals, crm.deals, [
			"id",
			"name",
			"companyId",
			"stage",
			"amount",
			"currency",
			"updatedAt",
		]),
		inquiries: changedRows(previous.crm.inquiries, crm.inquiries, [
			"id",
			"reference",
			"status",
			"companyId",
			"dealId",
			"updatedAt",
		]),
	};
	await json(`${paperclipUrl}/api/agents/${agent.id}/wakeup`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
				source: "on_demand",
				triggerDetail: "system",
			reason:
				"CRM sales data changed. Reconcile the V-OS revenue pipeline and update only work that requires action.",
			payload: {
				source: "v-os-crm",
				objective: crm.objective,
				metrics: crm.metrics,
				changes,
			},
			idempotencyKey: `crm-sales-${crm.revision}`,
		}),
	});
}

async function notifyAsina(previous, crm) {
	if (!previous?.crm?.revision || previous.crm.revision === crm.revision)
		return;
	const config = JSON.parse(await readFile(agentCoreBridgePath, "utf8"));
	const body = JSON.stringify({
		event_type: "crm.snapshot.changed",
		source: "v-os-crm",
		idempotency_key: `crm-snapshot-${crm.revision}`,
		occurred_at: new Date().toISOString(),
		objective: crm.objective,
		metrics: crm.metrics,
		changes: {
			companies: changedRows(previous.crm.companies, crm.companies, [
				"id",
				"name",
				"updatedAt",
			]),
			contacts: changedRows(previous.crm.contacts, crm.contacts, [
				"id",
				"companyId",
				"updatedAt",
			]),
			deals: changedRows(previous.crm.deals, crm.deals, [
				"id",
				"name",
				"companyId",
				"stage",
				"amount",
				"currency",
				"updatedAt",
			]),
			inquiries: changedRows(previous.crm.inquiries, crm.inquiries, [
				"id",
				"reference",
				"status",
				"companyId",
				"dealId",
				"updatedAt",
			]),
			projects: changedRows(previous.crm.projects, crm.projects, [
				"id",
				"name",
				"companyId",
				"status",
				"dueDate",
				"updatedAt",
			]),
			invoices: changedRows(previous.crm.invoices, crm.invoices, [
				"id",
				"number",
				"companyId",
				"status",
				"dueDate",
				"total",
				"amountPaid",
				"currency",
				"updatedAt",
			]),
			businessRecords: changedRows(
				previous.crm.businessRecords,
				crm.businessRecords,
				[
					"id",
					"type",
					"reference",
					"companyId",
					"projectId",
					"amount",
					"currency",
					"includedInFinancials",
					"dueAt",
					"updatedAt",
				],
			),
			milestones: changedRows(previous.crm.milestones, crm.milestones, [
				"id",
				"projectId",
				"title",
				"dueDate",
				"completedAt",
				"updatedAt",
			]),
		},
	});
	await postAgentCore(config, body);
}

async function postAgentCore(config, body) {
	const parsed = JSON.parse(body);
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = createHmac("sha256", config.secret)
		.update(`${timestamp}.${body}`)
		.digest("hex");
	await json(config.url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Webhook-Timestamp": timestamp,
			"X-Webhook-Signature-V2": signature,
			"X-Request-ID": parsed.idempotency_key,
		},
		body,
	});
}

async function telegramCredentials(envPath) {
	const text = await readFile(envPath, "utf8");
	const values = new Map();
	for (const line of text.split(/\r?\n/)) {
		const match = line.match(/^\s*([^#=]+)=(.*)$/);
		if (!match) continue;
		values.set(match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, ""));
	}
	const token = values.get("TELEGRAM_BOT_TOKEN");
	const chatId = values.get("TELEGRAM_HOME_CHANNEL");
	if (!token || !chatId)
		throw new Error("Violet Telegram credentials are incomplete.");
	return { token, chatId };
}

async function notifyFounderOnTelegram(config, summary) {
	const { token, chatId } = await telegramCredentials(config.telegramEnv);
	const response = await fetch(
		`https://api.telegram.org/bot${token}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: chatId,
				text: summary,
				disable_web_page_preview: true,
			}),
			signal: AbortSignal.timeout(30_000),
		},
	);
	if (!response.ok)
		throw new Error(
			`Violet Telegram notification failed (${response.status}).`,
		);
}

async function wakePaperclipViolet(config, inquiry, eventType) {
	if (!config.paperclipAgentId)
		throw new Error("Violet Paperclip agent is not configured.");
	await json(`${paperclipUrl}/api/agents/${config.paperclipAgentId}/wakeup`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			source: "on_demand",
				triggerDetail: "system",
			reason:
				"Own this V-OS lead lifecycle: verify CRM linkage, prepare the next follow-up and nurture action, create internal due tasks, and present every external engagement or escalation to Matthew for approval before sending. Keep Asina informed; send delivery risks to Robi.",
			payload: {
				source: "onevayu.com",
				eventType,
				inquiry,
				approvalRequired: true,
				externalSendingAllowed: false,
			},
			idempotencyKey:
				eventType === "website.inquiry"
					? `violet-lead-${inquiry.id}`
					: `violet-lead-update-${inquiry.id}-${inquiry.updatedAt}`,
		}),
	});
}

async function notifyViolet(previous, crm) {
	if (!previous?.crm?.revision || previous.crm.revision === crm.revision)
		return;
	const config = JSON.parse(await readFile(agentCoreBridgePath, "utf8"));
	if (!config.violet?.url || !config.violet?.secret)
		throw new Error("Violet website inquiry bridge is not configured.");
	const inquiries = newRows(previous.crm.inquiries, crm.inquiries).filter(
		(inquiry) => inquiry.source === "WEBSITE",
	);
	for (const inquiry of inquiries) {
		await postAgentCore(
			config.violet,
			JSON.stringify(websiteInquiryEvent(inquiry)),
		);
		await wakePaperclipViolet(config.violet, inquiry, "website.inquiry");
		await notifyFounderOnTelegram(
			config.violet,
			websiteInquiryTelegramSummary(inquiry),
		);
	}
	const updates = updatedRows(previous.crm.inquiries, crm.inquiries).filter(
		(inquiry) => inquiry.source === "WEBSITE",
	);
	for (const inquiry of updates) {
		await postAgentCore(
			config.violet,
			JSON.stringify(websiteInquiryUpdatedEvent(inquiry)),
		);
		await wakePaperclipViolet(
			config.violet,
			inquiry,
			"website.inquiry.updated",
		);
		await notifyFounderOnTelegram(
			config.violet,
			websiteInquiryUpdateTelegramSummary(inquiry),
		);
	}
}

async function synchronizeSales(paperclip) {
	const crm = await json(`${crmUrl}/internal/paperclip/bridge/sales`, {
		headers: authHeaders,
	});
	const previous = await readUnifiedSnapshot();
	const unified = {
		schemaVersion: 1,
		syncedAt: new Date().toISOString(),
		objective: crm.objective,
		crm,
		paperclip,
	};
	await Promise.all([
		notifySalesAgent(previous, crm, paperclip.agents),
		notifyAsina(previous, crm).catch((error) =>
			console.error(
				new Date().toISOString(),
				"Agent Core CRM notification failed",
				error,
			),
		),
		notifyViolet(previous, crm),
	]);
	await writeUnifiedSnapshot(unified);
}

async function deliver(row) {
	const payload = row.payload || {};
	if (row.kind === "instruction" || row.kind === "automation") {
		await json(`${paperclipUrl}/api/agents/${row.targetId}/wakeup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				source: "on_demand",
				triggerDetail: row.kind === "automation" ? "system" : "manual",
				reason: String(payload.message || payload.kind || "CRM instruction"),
				payload:
					row.kind === "automation"
						? { ...payload, source: "vayu-crm" }
						: { instruction: payload.message, source: "vayu-crm" },
				idempotencyKey: row.id,
			}),
		});
	} else if (row.kind === "approval") {
		await json(
			`${paperclipUrl}/api/approvals/${row.targetId}/${payload.action}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ decisionNote: payload.note || null }),
			},
		);
	} else if (row.kind === "workflow") {
		await json(`${paperclipUrl}/api/routines/${row.targetId}/run`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	}
}

async function cycle() {
	await snapshot();
	const rows = await json(`${crmUrl}/internal/paperclip/bridge/outbox`, {
		headers: authHeaders,
	});
	for (const row of rows) {
		let error;
		try {
			await deliver(row);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
		await json(`${crmUrl}/internal/paperclip/bridge/outbox/${row.id}`, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify(error ? { error } : {}),
		});
	}
}

for (;;) {
	try {
		await cycle();
	} catch (error) {
		console.error(new Date().toISOString(), error);
	}
	await new Promise((resolve) => setTimeout(resolve, 5000));
}
