import {
	type Db,
	InvoiceStatus,
	type Prisma,
	Prisma as PrismaNamespace,
} from "@crm/db";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { blankToNull, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { NotificationsService } from "../notifications/notifications.service";
import { FACET_ALL, paginate, resolveOrderBy } from "../trpc/list-input";
import type {
	InvoiceCreateInput,
	InvoiceListInput,
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
	company: { select: { id: true, name: true, website: true } },
	project: { select: { id: true, name: true } },
	lines: {
		orderBy: { position: "asc" as const },
		include: { catalogItem: true },
	},
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

	async list(input: InvoiceListInput) {
		const term = input.q.trim();
		const where: Prisma.InvoiceWhereInput = {
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

	async byId(id: string): Promise<InvoiceDetail> {
		const row = await this.db.invoice.findUnique({
			where: { id },
			include: INVOICE_DETAIL_INCLUDE,
		});
		if (!row) throw new NotFoundException(`No invoice with id ${id}.`);
		return serialize(row);
	}

	async create(input: InvoiceCreateInput, userId: string) {
		const issueDate = new Date(`${input.issueDate}T12:00:00.000Z`);
		const dueDate = new Date(`${input.dueDate}T12:00:00.000Z`);
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

	async send(id: string) {
		const invoice = await this.byId(id);
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

	async setStatus(id: string, status: InvoiceStatus) {
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
