import { readFileSync } from "node:fs";
import {
	BusinessRecordType,
	db,
	DealStage,
	InvoiceStatus,
	ProjectStatus,
	ProjectTaskPriority,
	ProjectTaskStatus,
	RecordSource,
} from "../src/index";

type SqlValue = string | number | null;
type Row = Record<string, SqlValue>;
type TableMap = Map<string, Row[]>;

const SOURCE = "PERFEX";
const TABLES = new Set([
	"tblclients",
	"tblcontacts",
	"tblleads",
	"tblprojects",
	"tbltasks",
	"tblinvoices",
	"tblinvoicepaymentrecords",
	"tblitems",
	"tblitemable",
	"tblestimates",
	"tblexpenses",
	"tblcontracts",
	"tbltickets",
	"tblstaff",
	"tblnotes",
	"tblcurrencies",
	"tblleads_status",
]);
const dumpPath = process.argv.find((value) =>
	value.toLowerCase().endsWith(".sql"),
);
const apply = process.argv.includes("--apply");
if (!dumpPath) throw new Error("Usage: bun perfex:import <dump.sql> [--apply]");

const tables = parseDump(readFileSync(dumpPath, "utf8"), TABLES);
const inventory = Object.fromEntries(
	[...TABLES].map((name) => [name, tables.get(name)?.length ?? 0]),
);
if (!apply) {
	process.stdout.write(
		`${JSON.stringify({ mode: "dry-run", inventory, mapped: mappingSummary(tables) }, null, 2)}\n`,
	);
	process.exit(0);
}

const owner = await db.user.findFirst({
	orderBy: { createdAt: "asc" },
	select: { id: true },
});
if (!owner)
	throw new Error("Create the first CRM user before importing Perfex.");
const ownerId = owner.id;
const currencies = new Map(
	rows(tables, "tblcurrencies").map((row) => [id(row.id), currencyCode(row)]),
);
const leadStatuses = new Map(
	rows(tables, "tblleads_status").map((row) => [id(row.id), text(row.name)]),
);
const clientIds = new Map<string, string>();
const contactIds = new Map<string, string>();
const leadCompanyIds = new Map<string, string>();
const projectIds = new Map<string, string>();
const invoiceIds = new Map<string, string>();
const leadToClient = new Map(
	rows(tables, "tblclients")
		.filter((row) => row.leadid)
		.map((row) => [id(row.leadid), id(row.userid)]),
);
const counts: Record<string, number> = {};

for (const row of rows(tables, "tblclients")) {
	const sourceId = id(row.userid);
	const linked = await linkedEntity("tblclients", sourceId);
	const domain = domainOf(text(row.website));
	const existing = linked
		? await db.company.findUnique({ where: { id: linked } })
		: domain
			? await db.company.findUnique({ where: { domain } })
			: await db.company.findFirst({
					where: { name: { equals: text(row.company), mode: "insensitive" } },
				});
	const data = {
		name: text(row.company) || `Perfex client ${sourceId}`,
		domain,
		website: urlOf(text(row.website)),
		phone: nullable(row.phonenumber),
		city: nullable(row.city),
		stateCode: nullable(row.state),
		countryCode: Number(row.country) === 110 ? "JM" : null,
		description: address(row),
		source: RecordSource.IMPORT,
		enrichmentStatus: "SKIPPED" as const,
	};
	const company = existing
		? await db.company.update({
				where: { id: existing.id },
				data,
				select: { id: true },
			})
		: await db.company.create({ data, select: { id: true } });
	clientIds.set(sourceId, company.id);
	await link("tblclients", sourceId, "company", company.id);
	bump(counts, "companies");
}

for (const row of rows(tables, "tblcontacts")) {
	const sourceId = id(row.id);
	const email = emailOf(row.email);
	const linked = await linkedEntity("tblcontacts", sourceId);
	const existing = linked
		? await db.contact.findUnique({ where: { id: linked } })
		: email
			? await db.contact.findUnique({ where: { email } })
			: null;
	const data = {
		firstName: text(row.firstname) || "Unknown",
		lastName: nullable(row.lastname),
		email,
		phone: nullable(row.phonenumber),
		title: nullable(row.title),
		companyId: clientIds.get(id(row.userid)) ?? null,
		source: RecordSource.IMPORT,
		enrichmentStatus: "SKIPPED" as const,
	};
	const contact = existing
		? await db.contact.update({
				where: { id: existing.id },
				data,
				select: { id: true },
			})
		: await db.contact.create({ data, select: { id: true } });
	contactIds.set(sourceId, contact.id);
	await link("tblcontacts", sourceId, "contact", contact.id);
	bump(counts, "contacts");
}

for (const row of rows(tables, "tblleads")) {
	const sourceId = id(row.id);
	const clientId = leadToClient.get(sourceId);
	let companyId = clientId ? clientIds.get(clientId) : undefined;
	if (!companyId) {
		const leadDomain =
			domainOf(text(row.website)) ??
			domainOf(emailOf(row.email)?.split("@")[1] ?? "");
		const companyName =
			text(row.company) || text(row.name) || `Perfex lead ${sourceId}`;
		let company = leadDomain
			? await db.company.findUnique({
					where: { domain: leadDomain },
					select: { id: true },
				})
			: null;
		if (!company)
			company = await db.company.findFirst({
				where: { name: { equals: companyName, mode: "insensitive" } },
				select: { id: true },
			});
		if (!company)
			company = await db.company.create({
				data: {
					name: companyName,
					domain: leadDomain,
					website: urlOf(text(row.website)),
					phone: nullable(row.phonenumber),
					city: nullable(row.city),
					stateCode: nullable(row.state),
					source: RecordSource.IMPORT,
					enrichmentStatus: "SKIPPED",
				},
				select: { id: true },
			});
		companyId = company.id;
	}
	leadCompanyIds.set(sourceId, companyId);
	const email = emailOf(row.email);
	let contact = email
		? await db.contact.findUnique({ where: { email }, select: { id: true } })
		: null;
	if (!contact)
		contact = await db.contact.create({
			data: {
				firstName: firstName(text(row.name)),
				lastName: lastName(text(row.name)),
				email,
				phone: nullable(row.phonenumber),
				title: nullable(row.title),
				companyId,
				source: RecordSource.IMPORT,
				enrichmentStatus: "SKIPPED",
			},
			select: { id: true },
		});
	const linked = await linkedEntity("tblleads", sourceId);
	const dealData = {
		name: `${text(row.company) || text(row.name) || "Lead"} — ${text(row.title) || "Opportunity"}`,
		description: nullable(stripHtml(text(row.description))),
		companyId,
		ownerId,
		stage: dealStage(leadStatuses.get(id(row.status)) ?? ""),
		stageChangedAt:
			safeDate(row.last_status_change) ?? safeDate(row.dateadded) ?? new Date(),
		expectedCloseDate: null,
		currency: "JMD",
	};
	const deal = linked
		? await db.deal.update({
				where: { id: linked },
				data: dealData,
				select: { id: true },
			})
		: await db.deal.create({ data: dealData, select: { id: true } });
	await db.dealContact.upsert({
		where: { dealId_contactId: { dealId: deal.id, contactId: contact.id } },
		create: { dealId: deal.id, contactId: contact.id, role: "Lead contact" },
		update: {},
	});
	await link("tblleads", sourceId, "deal", deal.id);
	bump(counts, "deals");
}

for (const row of rows(tables, "tblprojects")) {
	const sourceId = id(row.id);
	const linked = await linkedEntity("tblprojects", sourceId);
	const data = {
		name: text(row.name) || `Perfex project ${sourceId}`,
		description: nullable(stripHtml(text(row.description))),
		status: projectStatus(row.status),
		companyId: clientIds.get(id(row.clientid)) ?? null,
		ownerId,
		startDate: safeDate(row.start_date),
		dueDate: safeDate(row.deadline),
		budget: decimal(row.project_cost),
		currency: currencies.get(id(row.currency)) ?? "JMD",
	};
	const project = linked
		? await db.project.update({
				where: { id: linked },
				data,
				select: { id: true },
			})
		: await db.project.create({
				data: {
					...data,
					members: { create: { userId: ownerId, role: "Imported owner" } },
				},
				select: { id: true },
			});
	projectIds.set(sourceId, project.id);
	await link("tblprojects", sourceId, "project", project.id);
	bump(counts, "projects");
}

for (const row of rows(tables, "tbltasks")) {
	const sourceId = id(row.id);
	const projectId =
		text(row.rel_type) === "project"
			? projectIds.get(id(row.rel_id))
			: undefined;
	if (projectId) {
		const linked = await linkedEntity("tbltasks", sourceId);
		const data = {
			projectId,
			title: text(row.name) || `Perfex task ${sourceId}`,
			description: nullable(stripHtml(text(row.description))),
			status: taskStatus(row.status),
			priority: taskPriority(row.priority),
			createdById: ownerId,
			dueDate: safeDate(row.duedate),
			completedAt: safeDate(row.datefinished),
			position: Math.round(number(row.kanban_order)),
		};
		const task = linked
			? await db.projectTask.update({
					where: { id: linked },
					data,
					select: { id: true },
				})
			: await db.projectTask.create({ data, select: { id: true } });
		await link("tbltasks", sourceId, "projectTask", task.id);
		bump(counts, "projectTasks");
	} else {
		await upsertRecord(BusinessRecordType.TASK, sourceId, {
			reference: `TSK-${sourceId}`,
			title: text(row.name) || `Perfex task ${sourceId}`,
			status: label(taskStatus(row.status)),
			description: nullable(stripHtml(text(row.description))),
			occurredAt: safeDate(row.dateadded),
			dueAt: safeDate(row.duedate),
			companyId: relationCompany(row, clientIds, leadCompanyIds),
			metadata: {
				relationType: text(row.rel_type),
				relationId: id(row.rel_id),
				priority: number(row.priority),
			},
		});
		bump(counts, "otherTasks");
	}
}

const itemables = rows(tables, "tblitemable");
const paymentsByInvoice = groupSum(
	rows(tables, "tblinvoicepaymentrecords"),
	"invoiceid",
	"amount",
);
for (const row of rows(tables, "tblinvoices")) {
	const sourceId = id(row.id);
	const companyId = clientIds.get(id(row.clientid));
	if (!companyId) continue;
	const lines = itemables.filter(
		(item) => text(item.rel_type) === "invoice" && id(item.rel_id) === sourceId,
	);
	const linked = await linkedEntity("tblinvoices", sourceId);
	const total = number(row.total);
	const paid = paymentsByInvoice.get(sourceId) ?? 0;
	const invoiceData = {
		number:
			text(row.formatted_number) ||
			`${text(row.prefix) || "INV-"}${text(row.number) || sourceId}`,
		status: invoiceStatus(row.status),
		companyId,
		projectId: projectIds.get(id(row.project_id)) ?? null,
		createdById: ownerId,
		issueDate: safeDate(row.date) ?? new Date(),
		dueDate: safeDate(row.duedate) ?? safeDate(row.date) ?? new Date(),
		currency: currencies.get(id(row.currency)) ?? "JMD",
		subtotal: decimal(row.subtotal) ?? "0",
		tax: decimal(row.total_tax) ?? "0",
		total: decimal(row.total) ?? "0",
		amountPaid: String(paid),
		notes: nullable(
			stripHtml(
				[text(row.clientnote), text(row.adminnote), text(row.terms)]
					.filter(Boolean)
					.join("\n\n"),
			),
		),
		sentAt: safeDate(row.datesend),
		paidAt:
			paid >= total && total > 0
				? (safeDate(row.last_overdue_reminder) ?? safeDate(row.date))
				: null,
	};
	const invoice = linked
		? await db.invoice.update({
				where: { id: linked },
				data: invoiceData,
				select: { id: true },
			})
		: await db.invoice.create({
				data: { ...invoiceData, lines: { create: invoiceLines(lines, total) } },
				select: { id: true },
			});
	invoiceIds.set(sourceId, invoice.id);
	await link("tblinvoices", sourceId, "invoice", invoice.id);
	bump(counts, "invoices");
}

for (const row of rows(tables, "tblitems")) {
	const sourceId = id(row.id);
	const code = `PERFEX-${sourceId}`;
	const item = await db.catalogItem.upsert({
		where: { code },
		create: {
			code,
			name: text(row.description) || `Perfex item ${sourceId}`,
			kind: "SERVICE",
			category: "Perfex catalog",
			summary:
				nullable(stripHtml(text(row.long_description))) ||
				text(row.description) ||
				"Imported Perfex catalog item",
			outcomes: [],
			capabilities: [],
			measures: [],
			sourceUrl: "https://onevayu.com",
		},
		update: {
			name: text(row.description) || `Perfex item ${sourceId}`,
			summary:
				nullable(stripHtml(text(row.long_description))) ||
				text(row.description) ||
				"Imported Perfex catalog item",
		},
		select: { id: true },
	});
	await link("tblitems", sourceId, "catalogItem", item.id);
	bump(counts, "catalogItems");
}

for (const row of rows(tables, "tblestimates")) {
	const sourceId = id(row.id);
	await upsertRecord(BusinessRecordType.ESTIMATE, sourceId, {
		reference:
			text(row.formatted_number) ||
			`${text(row.prefix) || "EST-"}${text(row.number) || sourceId}`,
		title:
			text(row.adminnote) || text(row.reference_no) || `Estimate ${sourceId}`,
		status: estimateStatus(row.status),
		description: nullable(
			stripHtml(
				[text(row.clientnote), text(row.terms)].filter(Boolean).join("\n\n"),
			),
		),
		amount: decimal(row.total),
		currency: currencies.get(id(row.currency)) ?? "JMD",
		occurredAt: safeDate(row.date),
		dueAt: safeDate(row.expirydate),
		companyId: clientIds.get(id(row.clientid)) ?? null,
		projectId: projectIds.get(id(row.project_id)) ?? null,
		invoiceId: invoiceIds.get(id(row.invoiceid)) ?? null,
	});
	bump(counts, "estimates");
}

for (const row of rows(tables, "tblexpenses")) {
	const sourceId = id(row.id);
	await upsertRecord(BusinessRecordType.EXPENSE, sourceId, {
		reference: text(row.reference_no) || `EXP-${sourceId}`,
		title: text(row.expense_name) || text(row.note) || `Expense ${sourceId}`,
		status:
			Number(row.approval_status) === 2
				? "Approved"
				: Number(row.approval_status) === 3
					? "Rejected"
					: "Recorded",
		description: nullable(stripHtml(text(row.note))),
		amount: decimal(row.amount),
		currency: currencies.get(id(row.currency)) ?? "JMD",
		occurredAt: safeDate(row.date),
		companyId: clientIds.get(id(row.clientid)) ?? null,
		projectId: projectIds.get(id(row.project_id)) ?? null,
		metadata: {
			categoryId: id(row.category),
			billable: Boolean(Number(row.billable)),
		},
	});
	bump(counts, "expenses");
}

for (const row of rows(tables, "tblcontracts")) {
	const sourceId = id(row.id);
	await upsertRecord(BusinessRecordType.CONTRACT, sourceId, {
		reference: `CON-${sourceId}`,
		title: text(row.subject) || `Contract ${sourceId}`,
		status: Number(row.signed)
			? "Signed"
			: Number(row.trash)
				? "Archived"
				: "Active",
		description: nullable(
			stripHtml(
				[text(row.description), text(row.content)].filter(Boolean).join("\n\n"),
			),
		),
		amount: decimal(row.contract_value),
		currency: "JMD",
		occurredAt: safeDate(row.datestart),
		dueAt: safeDate(row.dateend),
		companyId: clientIds.get(id(row.client)) ?? null,
	});
	bump(counts, "contracts");
}

for (const row of rows(tables, "tbltickets")) {
	const sourceId = id(row.ticketid);
	await upsertRecord(BusinessRecordType.TICKET, sourceId, {
		reference: `TKT-${sourceId}`,
		title: text(row.subject) || `Ticket ${sourceId}`,
		status: `Status ${text(row.status) || "unknown"}`,
		description: nullable(stripHtml(text(row.message)).slice(0, 100000)),
		occurredAt: safeDate(row.date),
		companyId: clientIds.get(id(row.userid)) ?? null,
		projectId: projectIds.get(id(row.project_id)) ?? null,
		contactId: contactIds.get(id(row.contactid)) ?? null,
		metadata: {
			priority: number(row.priority),
			department: number(row.department),
			assigned: number(row.assigned),
		},
	});
	bump(counts, "tickets");
}

for (const row of rows(tables, "tblstaff")) {
	const sourceId = id(row.staffid);
	await upsertRecord(BusinessRecordType.STAFF, sourceId, {
		reference: `STA-${sourceId}`,
		title:
			[text(row.firstname), text(row.lastname)].filter(Boolean).join(" ") ||
			`Staff ${sourceId}`,
		status: Number(row.active) ? "Active" : "Inactive",
		description: nullable(
			[emailOf(row.email), text(row.phonenumber), text(row.job_position)]
				.filter(Boolean)
				.join(" · "),
		),
		occurredAt: safeDate(row.datecreated),
		metadata: {
			email: emailOf(row.email),
			phone: nullable(row.phonenumber),
			position: nullable(row.job_position),
		},
	});
	bump(counts, "staff");
}

for (const row of rows(tables, "tblnotes")) {
	const sourceId = id(row.id);
	await upsertRecord(BusinessRecordType.NOTE, sourceId, {
		reference: `NOT-${sourceId}`,
		title: `Perfex note ${sourceId}`,
		status: "Imported",
		description: nullable(stripHtml(text(row.description))),
		occurredAt: safeDate(row.dateadded),
		companyId:
			text(row.rel_type) === "customer"
				? (clientIds.get(id(row.rel_id)) ?? null)
				: null,
		projectId:
			text(row.rel_type) === "project"
				? (projectIds.get(id(row.rel_id)) ?? null)
				: null,
		metadata: { relationType: text(row.rel_type), relationId: id(row.rel_id) },
	});
	bump(counts, "notes");
}

for (const row of rows(tables, "tblinvoicepaymentrecords")) {
	const sourceId = id(row.id);
	await upsertRecord(BusinessRecordType.PAYMENT, sourceId, {
		reference: text(row.transactionid) || `PAY-${sourceId}`,
		title: `Payment for invoice ${id(row.invoiceid)}`,
		status: "Received",
		amount: decimal(row.amount),
		currency: "JMD",
		occurredAt: safeDate(row.date),
		invoiceId: invoiceIds.get(id(row.invoiceid)) ?? null,
		description: nullable(stripHtml(text(row.note))),
	});
	bump(counts, "payments");
}

process.stdout.write(
	`${JSON.stringify({ mode: "applied", inventory, imported: counts }, null, 2)}\n`,
);
await db.$disconnect();

async function linkedEntity(
	sourceTable: string,
	sourceId: string,
): Promise<string | null> {
	const row = await db.externalRecordLink.findUnique({
		where: {
			source_sourceTable_sourceId: { source: SOURCE, sourceTable, sourceId },
		},
		select: { entityId: true },
	});
	return row?.entityId ?? null;
}

async function link(
	sourceTable: string,
	sourceId: string,
	entityType: string,
	entityId: string,
) {
	await db.externalRecordLink.upsert({
		where: {
			source_sourceTable_sourceId: { source: SOURCE, sourceTable, sourceId },
		},
		create: { source: SOURCE, sourceTable, sourceId, entityType, entityId },
		update: { entityType, entityId },
	});
}

async function upsertRecord(
	type: BusinessRecordType,
	sourceId: string,
	data: Record<string, unknown>,
) {
	await db.businessRecord.upsert({
		where: { source_type_sourceId: { source: SOURCE, type, sourceId } },
		create: {
			type,
			source: SOURCE,
			sourceId,
			title: `Perfex ${label(type)} ${sourceId}`,
			...data,
		},
		update: data,
	});
}

function parseDump(sql: string, wanted: Set<string>): TableMap {
	const result: TableMap = new Map();
	const expression = /INSERT INTO `([^`]+)` \(([^)]+)\) VALUES\s*/g;
	for (let match = expression.exec(sql); match; match = expression.exec(sql)) {
		const table = match[1] ?? "";
		if (!wanted.has(table)) continue;
		const columns = (match[2] ?? "")
			.split(",")
			.map((value) => value.trim().replaceAll("`", ""));
		const end = statementEnd(sql, expression.lastIndex);
		const parsed = parseValues(sql.slice(expression.lastIndex, end), columns);
		result.set(table, [...(result.get(table) ?? []), ...parsed]);
		expression.lastIndex = end + 1;
	}
	return result;
}

function statementEnd(sql: string, start: number): number {
	let quoted = false;
	for (let index = start; index < sql.length; index += 1) {
		const char = sql[index];
		if (char === "\\" && quoted) {
			index += 1;
			continue;
		}
		if (char === "'") quoted = !quoted;
		if (char === ";" && !quoted) return index;
	}
	return sql.length;
}

function parseValues(valueText: string, columns: string[]): Row[] {
	const output: Row[] = [];
	let index = 0;
	while (index < valueText.length) {
		if (valueText[index] !== "(") {
			index += 1;
			continue;
		}
		index += 1;
		const values: SqlValue[] = [];
		while (index < valueText.length) {
			while (/\s/.test(valueText[index] ?? "")) index += 1;
			let token = "";
			let quoted = false;
			if (valueText[index] === "'") {
				quoted = true;
				index += 1;
				while (index < valueText.length) {
					const char = valueText[index++];
					if (char === "\\") {
						token += mysqlEscape(valueText[index++] ?? "");
						continue;
					}
					if (char === "'") break;
					token += char;
				}
			} else {
				while (
					index < valueText.length &&
					valueText[index] !== "," &&
					valueText[index] !== ")"
				)
					token += valueText[index++];
			}
			values.push(quoted ? token : scalar(token.trim()));
			while (/\s/.test(valueText[index] ?? "")) index += 1;
			if (valueText[index] === ",") {
				index += 1;
				continue;
			}
			if (valueText[index] === ")") {
				index += 1;
				break;
			}
		}
		output.push(
			Object.fromEntries(
				columns.map((column, position) => [column, values[position] ?? null]),
			),
		);
	}
	return output;
}

function scalar(value: string): SqlValue {
	if (!value || value.toUpperCase() === "NULL") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : value;
}
function mysqlEscape(value: string): string {
	return (
		(
			{ "0": "\0", n: "\n", r: "\r", t: "\t", b: "\b", Z: "\u001a" } as Record<
				string,
				string
			>
		)[value] ?? value
	);
}
function rows(map: TableMap, table: string): Row[] {
	return map.get(table) ?? [];
}
function id(value: SqlValue | undefined): string {
	return value == null ? "" : String(value);
}
function text(value: SqlValue | undefined): string {
	return value == null ? "" : String(value).trim();
}
function number(value: SqlValue | undefined): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
function nullable(value: SqlValue | string | undefined): string | null {
	const result = text(value as SqlValue);
	return result ? result : null;
}
function decimal(value: SqlValue | undefined): string | null {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}
function safeDate(value: SqlValue | undefined): Date | null {
	const source = text(value);
	if (!source || source.startsWith("0000-00-00")) return null;
	const parsed = new Date(
		source.includes("T") ? source : `${source.replace(" ", "T")}Z`,
	);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function emailOf(value: SqlValue | undefined): string | null {
	const email = text(value).toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
function domainOf(value: string): string | null {
	const cleaned =
		value
			.trim()
			.toLowerCase()
			.replace(/^https?:\/\//, "")
			.replace(/^www\./, "")
			.split(/[/?#]/)[0] ?? "";
	return cleaned.includes(".") ? cleaned : null;
}
function urlOf(value: string): string | null {
	const domain = domainOf(value);
	return domain ? `https://${domain}` : null;
}
function address(row: Row): string | null {
	return nullable(
		[
			text(row.address),
			[text(row.city), text(row.state), text(row.zip)]
				.filter(Boolean)
				.join(", "),
		]
			.filter(Boolean)
			.join("\n"),
	);
}
function firstName(name: string): string {
	return name.split(/\s+/)[0] || "Unknown";
}
function lastName(name: string): string | null {
	return nullable(name.split(/\s+/).slice(1).join(" "));
}
function stripHtml(value: string): string {
	return value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#039;/gi, "'")
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
function currencyCode(row: Row): string {
	const value = text(row.name) || text(row.currency_name) || "JMD";
	return value.length === 3
		? value.toUpperCase()
		: value.toLowerCase().includes("jama")
			? "JMD"
			: "USD";
}
function dealStage(value: string): DealStage {
	const status = value.toLowerCase();
	if (status.includes("lost") || status.includes("junk"))
		return DealStage.CLOSED_LOST;
	if (status.includes("won") || status.includes("customer"))
		return DealStage.CLOSED_WON;
	if (status.includes("contract")) return DealStage.CONTRACT_SENT;
	if (status.includes("qualified")) return DealStage.QUALIFIED_TO_BUY;
	return DealStage.DEMO_BOOKED;
}
function projectStatus(value: SqlValue | undefined): ProjectStatus {
	return (
		(
			{
				1: ProjectStatus.PLANNING,
				2: ProjectStatus.ACTIVE,
				3: ProjectStatus.ON_HOLD,
				4: ProjectStatus.CANCELLED,
				5: ProjectStatus.COMPLETED,
			} as Record<number, ProjectStatus>
		)[number(value)] ?? ProjectStatus.PLANNING
	);
}
function taskStatus(value: SqlValue | undefined): ProjectTaskStatus {
	return (
		(
			{
				1: ProjectTaskStatus.TODO,
				2: ProjectTaskStatus.BLOCKED,
				3: ProjectTaskStatus.IN_PROGRESS,
				4: ProjectTaskStatus.IN_PROGRESS,
				5: ProjectTaskStatus.DONE,
			} as Record<number, ProjectTaskStatus>
		)[number(value)] ?? ProjectTaskStatus.TODO
	);
}
function taskPriority(value: SqlValue | undefined): ProjectTaskPriority {
	return (
		(
			{
				1: ProjectTaskPriority.LOW,
				2: ProjectTaskPriority.MEDIUM,
				3: ProjectTaskPriority.HIGH,
				4: ProjectTaskPriority.URGENT,
			} as Record<number, ProjectTaskPriority>
		)[number(value)] ?? ProjectTaskPriority.MEDIUM
	);
}
function invoiceStatus(value: SqlValue | undefined): InvoiceStatus {
	return (
		(
			{
				1: InvoiceStatus.SENT,
				2: InvoiceStatus.PAID,
				3: InvoiceStatus.SENT,
				4: InvoiceStatus.OVERDUE,
				5: InvoiceStatus.VOID,
				6: InvoiceStatus.DRAFT,
			} as Record<number, InvoiceStatus>
		)[number(value)] ?? InvoiceStatus.DRAFT
	);
}
function estimateStatus(value: SqlValue | undefined): string {
	return (
		(
			{
				1: "Draft",
				2: "Sent",
				3: "Declined",
				4: "Accepted",
				5: "Expired",
			} as Record<number, string>
		)[number(value)] ?? "Imported"
	);
}
function relationCompany(
	row: Row,
	clients: Map<string, string>,
	leads: Map<string, string>,
): string | null {
	const type = text(row.rel_type);
	return type === "customer"
		? (clients.get(id(row.rel_id)) ?? null)
		: type === "lead"
			? (leads.get(id(row.rel_id)) ?? null)
			: null;
}
function invoiceLines(lines: Row[], fallbackTotal: number) {
	if (lines.length === 0)
		return [
			{
				description: "Imported Perfex invoice",
				quantity: "1",
				unitPrice: String(fallbackTotal),
				amount: String(fallbackTotal),
				position: 0,
			},
		];
	return lines.map((line, position) => ({
		description: text(line.description) || `Line ${position + 1}`,
		quantity: String(number(line.qty) || 1),
		unitPrice: String(number(line.rate)),
		amount: String((number(line.qty) || 1) * number(line.rate)),
		position: Math.round(number(line.item_order) || position),
	}));
}
function groupSum(
	values: Row[],
	key: string,
	amount: string,
): Map<string, number> {
	const result = new Map<string, number>();
	for (const row of values)
		result.set(
			id(row[key]),
			(result.get(id(row[key])) ?? 0) + number(row[amount]),
		);
	return result;
}
function bump(counts: Record<string, number>, key: string) {
	counts[key] = (counts[key] ?? 0) + 1;
}
function label(value: string): string {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/^./, (character) => character.toUpperCase());
}
function mappingSummary(map: TableMap) {
	return {
		companies: rows(map, "tblclients").length,
		contacts: rows(map, "tblcontacts").length,
		deals: rows(map, "tblleads").length,
		projects: rows(map, "tblprojects").length,
		projectTasks: rows(map, "tbltasks").filter(
			(row) => text(row.rel_type) === "project",
		).length,
		otherTasks: rows(map, "tbltasks").filter(
			(row) => text(row.rel_type) !== "project",
		).length,
		invoices: rows(map, "tblinvoices").length,
		catalogItems: rows(map, "tblitems").length,
		estimates: rows(map, "tblestimates").length,
		expenses: rows(map, "tblexpenses").length,
		contracts: rows(map, "tblcontracts").length,
		tickets: rows(map, "tbltickets").length,
		staff: rows(map, "tblstaff").length,
		notes: rows(map, "tblnotes").length,
		payments: rows(map, "tblinvoicepaymentrecords").length,
	};
}
