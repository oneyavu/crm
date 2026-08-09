import { WORKSPACE_ID } from "@crm/auth";
import {
	type Db,
	InvoiceStatus,
	NotificationType,
	type Prisma,
	Prisma as PrismaNamespace,
} from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	assignedCompanyIds,
	assignedInvoiceWhere,
	staffRole,
} from "../authz/staff-scope";
import { blankToNull, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { NotificationsService } from "../notifications/notifications.service";
import { FACET_ALL, paginate, resolveOrderBy } from "../trpc/list-input";
import type {
	InvoiceCreateInput,
	InvoiceListInput,
	InvoiceScheduleInput,
} from "./invoices.contracts";

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.InvoiceOrderByWithRelationInput
> = {
	number: (dir) => ({ number: dir }),
	company: (dir) => ({ company: { name: dir } }),
	status: (dir) => ({ status: dir }),
	dueDate: (dir) => ({ dueDate: dir }),
	total: (dir) => ({ total: dir }),
};

const INVOICE_DETAIL_INCLUDE = {
	company: {
		select: {
			id: true,
			name: true,
			website: true,
			city: true,
			stateCode: true,
			country: true,
			phone: true,
			email: true,
		},
	},
	project: { select: { id: true, name: true } },
	lines: {
		orderBy: { position: "asc" as const },
		include: { catalogItem: true },
	},
	templateSchedule: true,
} satisfies Prisma.InvoiceInclude;

type InvoiceDetailRow = Prisma.InvoiceGetPayload<{
	include: typeof INVOICE_DETAIL_INCLUDE;
}>;

type InvoiceDetail = Omit<
	InvoiceDetailRow,
	| "subtotal"
	| "tax"
	| "total"
	| "amountPaid"
	| "issueDate"
	| "dueDate"
	| "sentAt"
	| "paidAt"
	| "templateSchedule"
	| "lines"
> & {
	subtotalCents: number;
	taxCents: number;
	totalCents: number;
	amountPaidCents: number;
	issueDate: string;
	dueDate: string;
	sentAt: string | null;
	paidAt: string | null;
	templateSchedule: null | {
		id: string;
		kind: string;
		cadence: string;
		interval: number;
		nextIssueAt: string;
		paymentTermsDays: number;
		dueTime: string;
		active: boolean;
		sendAutomatically: boolean;
		remindAdmin: boolean;
		remindClient: boolean;
		reminderDays: number[];
		lastGeneratedAt: string | null;
	};
	lines: Array<
		Omit<
			InvoiceDetailRow["lines"][number],
			"quantity" | "unitPrice" | "amount"
		> & {
			quantity: number;
			unitPriceCents: number;
			amountCents: number;
		}
	>;
};

@Injectable()
export class InvoicesService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly notifications: NotificationsService,
	) {}

	async list(input: InvoiceListInput, userId: string) {
		const access = await staffRole(this.db, userId);
		const companyIds = access.admin
			? []
			: await assignedCompanyIds(this.db, userId);
		const term = input.q.trim();
		const filters: Prisma.InvoiceWhereInput = {
			...(term
				? {
						OR: [
							{ number: { contains: term, mode: "insensitive" as const } },
							{
								company: {
									name: { contains: term, mode: "insensitive" as const },
								},
							},
						],
					}
				: {}),
			...(input.status !== FACET_ALL
				? { status: input.status as InvoiceStatus }
				: {}),
		};
		const where: Prisma.InvoiceWhereInput = access.admin
			? filters
			: { AND: [filters, assignedInvoiceWhere(userId, companyIds)] };
		const { skip, take } = paginate(input);
		const [rows, total] = await Promise.all([
			this.db.invoice.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, { issueDate: "desc" }),
				select: {
					id: true,
					number: true,
					status: true,
					issueDate: true,
					dueDate: true,
					currency: true,
					total: true,
					amountPaid: true,
					company: { select: { id: true, name: true } },
					project: { select: { id: true, name: true } },
				},
			}),
			this.db.invoice.count({ where }),
		]);
		return {
			rows: rows.map((row) => ({
				...row,
				totalCents: toCents(row.total) ?? 0,
				amountPaidCents: toCents(row.amountPaid) ?? 0,
				total: undefined,
				amountPaid: undefined,
				issueDate: row.issueDate.toISOString(),
				dueDate: row.dueDate.toISOString(),
			})),
			total,
		};
	}

	async byId(id: string, userId: string): Promise<InvoiceDetail> {
		const access = await staffRole(this.db, userId);
		const companyIds = access.admin
			? []
			: await assignedCompanyIds(this.db, userId);
		const row = await this.db.invoice.findFirst({
			where: {
				id,
				...(access.admin ? {} : assignedInvoiceWhere(userId, companyIds)),
			},
			include: INVOICE_DETAIL_INCLUDE,
		});
		if (!row) throw new NotFoundException(`No invoice with id ${id}.`);
		return serialize(row);
	}

	async create(input: InvoiceCreateInput, userId: string) {
		const access = await staffRole(this.db, userId);
		if (!access.admin)
			throw new ForbiddenException("Invoice creation requires approval.");
		const issueDate = new Date(`${input.issueDate}T12:00:00.000Z`);
		const dueDate = new Date(`${input.dueDate}T${input.dueTime}:00.000Z`);
		if (dueDate < issueDate) {
			throw new BadRequestException(
				"Due date must be on or after the issue date.",
			);
		}
		const lines = input.lines.map((line, position) => {
			const amountCents = Math.round(line.quantity * line.unitPriceCents);
			return { ...line, position, amountCents };
		});
		const subtotalCents = lines.reduce(
			(sum, line) => sum + line.amountCents,
			0,
		);
		const totalCents = subtotalCents + input.taxCents;

		return this.db.$transaction(async (tx) => {
			const year = issueDate.getUTCFullYear();
			const sequence = await tx.invoiceSequence.upsert({
				where: { year },
				create: { year, value: 1 },
				update: { value: { increment: 1 } },
			});
			const number = `INV-${year}-${String(sequence.value).padStart(4, "0")}`;
			return tx.invoice.create({
				data: {
					number,
					companyId: input.companyId,
					projectId: input.projectId || null,
					createdById: userId,
					recipientName: blankToNull(input.recipientName ?? ""),
					recipientEmail: blankToNull(input.recipientEmail ?? ""),
					issueDate,
					dueDate,
					dueTime: input.dueTime,
					currency: input.currency,
					subtotal: moneyFromCents(subtotalCents),
					tax: moneyFromCents(input.taxCents),
					total: moneyFromCents(totalCents),
					notes: blankToNull(input.notes ?? ""),
					lines: {
						create: lines.map((line) => ({
							description: line.description,
							quantity: new PrismaNamespace.Decimal(line.quantity),
							unitPrice: moneyFromCents(line.unitPriceCents),
							amount: moneyFromCents(line.amountCents),
							position: line.position,
							catalogItemId: line.catalogItemId || null,
						})),
					},
				},
				select: { id: true, number: true },
			});
		});
	}

	async send(id: string, userId: string) {
		const invoice = await this.byId(id, userId);
		if (!invoice.recipientEmail) {
			throw new BadRequestException("Add a recipient email before sending.");
		}
		const delivery = await this.notifications.sendEmail({
			toEmail: invoice.recipientEmail,
			subject: `VAYU invoice ${invoice.number}`,
			html: invoiceHtml(invoice),
			invoiceId: invoice.id,
		});
		if (delivery.sent) {
			await this.db.invoice.update({
				where: { id },
				data: { status: InvoiceStatus.SENT, sentAt: new Date() },
			});
		}
		return delivery;
	}

	async setStatus(id: string, status: InvoiceStatus, userId: string) {
		const access = await staffRole(this.db, userId);
		if (!access.admin)
			throw new ForbiddenException("Invoice status changes require approval.");
		try {
			const current = await this.db.invoice.findUnique({
				where: { id },
				select: { total: true },
			});
			if (!current) throw new NotFoundException(`No invoice with id ${id}.`);
			const invoice = await this.db.invoice.update({
				where: { id },
				data: {
					status,
					...(status === InvoiceStatus.PAID
						? { paidAt: new Date(), amountPaid: current.total }
						: {}),
				},
				select: { id: true, number: true, status: true },
			});
			return invoice;
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No invoice with id ${id}.`);
			}
			throw error;
		}
	}

	async duplicate(
		id: string,
		userId: string,
		issueDateValue?: string,
		dueDateValue?: string,
	) {
		const access = await staffRole(this.db, userId);
		if (!access.admin)
			throw new ForbiddenException(
				"Invoice duplication requires administrator access.",
			);
		const source = await this.byId(id, userId);
		const issueDate = issueDateValue ?? new Date().toISOString().slice(0, 10);
		const sourceTerms = Math.max(
			0,
			Math.round(
				(new Date(source.dueDate).getTime() -
					new Date(source.issueDate).getTime()) /
					86_400_000,
			),
		);
		const dueDate =
			dueDateValue ??
			addDays(new Date(`${issueDate}T12:00:00.000Z`), sourceTerms)
				.toISOString()
				.slice(0, 10);
		return this.create(
			{
				companyId: source.companyId,
				projectId: source.projectId,
				recipientName: source.recipientName,
				recipientEmail: source.recipientEmail,
				issueDate,
				dueDate,
				dueTime: source.dueTime,
				currency: source.currency,
				taxCents: source.taxCents,
				notes: source.notes,
				lines: source.lines.map((line) => ({
					description: line.description,
					quantity: line.quantity,
					unitPriceCents: line.unitPriceCents,
					catalogItemId: line.catalogItemId,
				})),
			},
			userId,
		);
	}

	async saveSchedule(input: InvoiceScheduleInput, userId: string) {
		const access = await staffRole(this.db, userId);
		if (!access.admin)
			throw new ForbiddenException(
				"Recurring billing setup requires administrator access.",
			);
		const template = await this.db.invoice.findUnique({
			where: { id: input.templateInvoiceId },
			select: { id: true },
		});
		if (!template)
			throw new NotFoundException(
				`No invoice with id ${input.templateInvoiceId}.`,
			);
		const values = {
			kind: input.kind,
			cadence: input.cadence,
			interval: input.interval,
			nextIssueAt: new Date(input.nextIssueAt),
			paymentTermsDays: input.paymentTermsDays,
			dueTime: input.dueTime,
			active: input.active,
			sendAutomatically: input.sendAutomatically,
			remindAdmin: input.remindAdmin,
			remindClient: input.remindClient,
			reminderDays: [...new Set(input.reminderDays)].sort((a, b) => b - a),
		};
		return this.db.invoiceSchedule.upsert({
			where: { templateInvoiceId: input.templateInvoiceId },
			create: { templateInvoiceId: input.templateInvoiceId, ...values },
			update: values,
			select: {
				id: true,
				templateInvoiceId: true,
				active: true,
				nextIssueAt: true,
			},
		});
	}

	async processBillingAutomation() {
		const now = new Date();
		await this.db.invoice.updateMany({
			where: { status: InvoiceStatus.SENT, dueDate: { lt: now } },
			data: { status: InvoiceStatus.OVERDUE },
		});
		const schedules = await this.db.invoiceSchedule.findMany({
			where: { active: true, nextIssueAt: { lte: now } },
			include: { templateInvoice: { select: { id: true, createdById: true } } },
			take: 50,
		});
		let generated = 0;
		for (const schedule of schedules) {
			const nextIssueAt = advanceSchedule(
				schedule.nextIssueAt,
				schedule.cadence,
				schedule.interval,
			);
			const claimed = await this.db.invoiceSchedule.updateMany({
				where: {
					id: schedule.id,
					active: true,
					nextIssueAt: schedule.nextIssueAt,
				},
				data: { nextIssueAt },
			});
			if (!claimed.count) continue;
			const issueDate = schedule.nextIssueAt.toISOString().slice(0, 10);
			const dueDate = addDays(schedule.nextIssueAt, schedule.paymentTermsDays)
				.toISOString()
				.slice(0, 10);
			try {
				const created = await this.duplicate(
					schedule.templateInvoice.id,
					schedule.templateInvoice.createdById,
					issueDate,
					dueDate,
				);
				await this.db.invoice.update({
					where: { id: created.id },
					data: {
						scheduleId: schedule.id,
						dueTime: schedule.dueTime,
						dueDate: new Date(`${dueDate}T${schedule.dueTime}:00.000Z`),
					},
				});
				await this.db.invoiceSchedule.update({
					where: { id: schedule.id },
					data: { lastGeneratedAt: now },
				});
				if (schedule.sendAutomatically)
					await this.send(created.id, schedule.templateInvoice.createdById);
				generated += 1;
			} catch (error) {
				await this.db.invoiceSchedule.updateMany({
					where: { id: schedule.id, nextIssueAt },
					data: { nextIssueAt: schedule.nextIssueAt },
				});
				throw error;
			}
		}
		const reminded = await this.sendDueReminders(now);
		return { generated, reminded };
	}

	private async sendDueReminders(now: Date) {
		const start = new Date(now);
		start.setUTCHours(0, 0, 0, 0);
		const end = addDays(start, 91);
		const invoices = await this.db.invoice.findMany({
			where: {
				status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
				dueDate: { gte: addDays(start, -1), lt: end },
			},
			include: { schedule: true },
			take: 250,
		});
		const admins = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID, role: { in: ["owner", "admin"] } },
			select: { userId: true },
		});
		let sent = 0;
		for (const invoice of invoices) {
			const days = Math.ceil(
				(invoice.dueDate.getTime() - start.getTime()) / 86_400_000,
			);
			const reminderDays = invoice.schedule?.reminderDays ?? [7, 3, 1, 0];
			if (!reminderDays.includes(days)) continue;
			const subject = `Payment reminder: ${invoice.number} is ${days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`}`;
			const alreadySent = await this.db.emailDelivery.count({
				where: { invoiceId: invoice.id, subject, createdAt: { gte: start } },
			});
			if (alreadySent) continue;
			const body = `${invoice.number} has ${new Intl.NumberFormat("en", { style: "currency", currency: invoice.currency }).format(Number(invoice.total.minus(invoice.amountPaid)))} outstanding and is due ${invoice.dueDate.toISOString().slice(0, 10)} at ${invoice.dueTime}.`;
			if (invoice.schedule?.remindAdmin !== false)
				for (const admin of admins)
					await this.notifications.notifyUser({
						userId: admin.userId,
						type: NotificationType.INVOICE_DUE,
						title: subject,
						body,
						href: `/invoices/${invoice.id}`,
						invoiceId: invoice.id,
					});
			if (invoice.recipientEmail && invoice.schedule?.remindClient !== false)
				await this.notifications.sendEmail({
					toEmail: invoice.recipientEmail,
					subject,
					html: `<h1>${escapeHtml(subject)}</h1><p>${escapeHtml(body)}</p>`,
					invoiceId: invoice.id,
				});
			sent += 1;
		}
		return sent;
	}

	async delete(id: string, userId: string) {
		const access = await staffRole(this.db, userId);
		if (!access.admin)
			throw new ForbiddenException(
				"Invoice deletion requires administrator access.",
			);
		try {
			return await this.db.invoice.delete({
				where: { id },
				select: { id: true, number: true },
			});
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No invoice with id ${id}.`);
			}
			throw error;
		}
	}
}

function serialize(row: InvoiceDetailRow): InvoiceDetail {
	const {
		subtotal,
		tax,
		total,
		amountPaid,
		issueDate,
		dueDate,
		sentAt,
		paidAt,
		templateSchedule,
		lines,
		...invoice
	} = row;
	return {
		...invoice,
		subtotalCents: toCents(subtotal) ?? 0,
		taxCents: toCents(tax) ?? 0,
		totalCents: toCents(total) ?? 0,
		amountPaidCents: toCents(amountPaid) ?? 0,
		issueDate: issueDate.toISOString(),
		dueDate: dueDate.toISOString(),
		sentAt: sentAt?.toISOString() ?? null,
		paidAt: paidAt?.toISOString() ?? null,
		templateSchedule: templateSchedule
			? {
					id: templateSchedule.id,
					kind: templateSchedule.kind,
					cadence: templateSchedule.cadence,
					interval: templateSchedule.interval,
					nextIssueAt: templateSchedule.nextIssueAt.toISOString(),
					paymentTermsDays: templateSchedule.paymentTermsDays,
					dueTime: templateSchedule.dueTime,
					active: templateSchedule.active,
					sendAutomatically: templateSchedule.sendAutomatically,
					remindAdmin: templateSchedule.remindAdmin,
					remindClient: templateSchedule.remindClient,
					reminderDays: templateSchedule.reminderDays,
					lastGeneratedAt:
						templateSchedule.lastGeneratedAt?.toISOString() ?? null,
				}
			: null,
		lines: lines.map((line) => {
			const { quantity, unitPrice, amount, ...item } = line;
			return {
				...item,
				quantity: Number(quantity),
				unitPriceCents: toCents(unitPrice) ?? 0,
				amountCents: toCents(amount) ?? 0,
			};
		}),
	};
}

function invoiceHtml(invoice: InvoiceDetail): string {
	const money = new Intl.NumberFormat("en", {
		style: "currency",
		currency: invoice.currency,
	}).format(invoice.totalCents / 100);
	const lines = invoice.lines
		.map(
			(line) =>
				`<tr><td>${escapeHtml(line.description)}</td><td>${line.quantity}</td><td>${new Intl.NumberFormat("en", { style: "currency", currency: invoice.currency }).format(line.amountCents / 100)}</td></tr>`,
		)
		.join("");
	return `<h1>VAYU invoice ${escapeHtml(invoice.number)}</h1><p>Thank you for working with VAYU. The total due is <strong>${money}</strong> by ${escapeHtml(invoice.dueDate.slice(0, 10))}.</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function moneyFromCents(value: number): PrismaNamespace.Decimal {
	return new PrismaNamespace.Decimal(value).div(100);
}

function addDays(value: Date, days: number): Date {
	const result = new Date(value);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function advanceSchedule(value: Date, cadence: string, interval: number): Date {
	const result = new Date(value);
	if (cadence === "WEEKLY")
		result.setUTCDate(result.getUTCDate() + 7 * interval);
	else if (cadence === "MONTHLY")
		result.setUTCMonth(result.getUTCMonth() + interval);
	else if (cadence === "QUARTERLY")
		result.setUTCMonth(result.getUTCMonth() + 3 * interval);
	else if (cadence === "SEMIANNUAL")
		result.setUTCMonth(result.getUTCMonth() + 6 * interval);
	else result.setUTCFullYear(result.getUTCFullYear() + interval);
	return result;
}
