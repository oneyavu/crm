import { InvoiceStatus } from "@crm/db";
import { z } from "zod";
import { currencyCode } from "../currency/currency.contracts";
import { listInput } from "../trpc/list-input";

export const invoiceListInput = listInput.extend({
	status: z.string().default("all"),
});
export type InvoiceListInput = z.infer<typeof invoiceListInput>;

export const invoiceIdInput = z.object({ id: z.string().min(1) });

const invoiceLineInput = z.object({
	description: z.string().trim().min(1),
	quantity: z.number().positive(),
	unitPriceCents: z.number().int().min(0),
	catalogItemId: z.string().nullable().optional(),
});

export const invoiceCreateInput = z.object({
	companyId: z.string().min(1),
	projectId: z.string().nullable().optional(),
	recipientName: z.string().trim().nullable().optional(),
	recipientEmail: z.string().trim().email().nullable().optional(),
	issueDate: z.string().date(),
	dueDate: z.string().date(),
	dueTime: z
		.string()
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
		.default("17:00"),
	currency: currencyCode,
	taxCents: z.number().int().min(0).default(0),
	notes: z.string().trim().nullable().optional(),
	lines: z.array(invoiceLineInput).min(1),
});
export type InvoiceCreateInput = z.infer<typeof invoiceCreateInput>;

export const invoiceStatusInput = z.object({
	id: z.string().min(1),
	status: z.enum(
		Object.values(InvoiceStatus) as [InvoiceStatus, ...InvoiceStatus[]],
	),
});

export const invoiceDuplicateInput = z.object({
	id: z.string().min(1),
	issueDate: z.string().date().optional(),
	dueDate: z.string().date().optional(),
});

export const invoiceScheduleInput = z.object({
	templateInvoiceId: z.string().min(1),
	kind: z.enum(["RECURRING_INVOICE", "SUBSCRIPTION"]),
	cadence: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
	interval: z.number().int().min(1).max(24).default(1),
	nextIssueAt: z.string().datetime(),
	paymentTermsDays: z.number().int().min(0).max(365).default(7),
	dueTime: z
		.string()
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
		.default("17:00"),
	active: z.boolean().default(true),
	sendAutomatically: z.boolean().default(false),
	remindAdmin: z.boolean().default(true),
	remindClient: z.boolean().default(true),
	reminderDays: z
		.array(z.number().int().min(0).max(90))
		.min(1)
		.max(10)
		.default([7, 3, 1, 0]),
});
export type InvoiceScheduleInput = z.infer<typeof invoiceScheduleInput>;
