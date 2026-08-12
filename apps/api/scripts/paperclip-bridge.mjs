const crmUrl = (
	process.env.CRM_API_URL || "https://api.asina.onevayu.com"
).replace(/\/$/, "");
const paperclipUrl = (
	process.env.PAPERCLIP_URL || "http://127.0.0.1:3100"
).replace(/\/$/, "");
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const secret = process.env.PAPERCLIP_BRIDGE_SECRET;

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
	await json(`${crmUrl}/internal/paperclip/bridge/snapshot`, {
		method: "POST",
		headers: authHeaders,
		body: JSON.stringify({
			companyId,
			agents,
			approvals,
			activity,
			issues,
			routines,
		}),
	});
}

async function deliver(row) {
	const payload = row.payload || {};
	if (row.kind === "instruction" || row.kind === "automation") {
		await json(`${paperclipUrl}/api/agents/${row.targetId}/wakeup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				source: "on_demand",
				triggerDetail:
					row.kind === "automation" ? "platform-operations" : "manual",
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
