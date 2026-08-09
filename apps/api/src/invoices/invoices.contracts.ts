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
