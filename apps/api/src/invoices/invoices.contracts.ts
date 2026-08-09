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

export const invoiceAssistantStartInput = z
	.object({
		purpose: z.enum(["CLIENT_WORK", "GENERAL_KNOWLEDGE"]),
		companyId: z.string().min(1).nullable().optional(),
		newClient: z
			.object({
				name: z.string().trim().min(1).max(240),
				domain: z.string().trim().max(240).nullable().optional(),
				email: z.string().trim().email().nullable().optional(),
				phone: z.string().trim().max(80).nullable().optional(),
				staffNotes: z.string().trim().max(4000).nullable().optional(),
			})
			.nullable()
			.optional(),
	})
	.superRefine((value, context) => {
		if (
			value.purpose === "CLIENT_WORK" &&
			!value.companyId &&
			!value.newClient
		) {
			context.addIssue({
				code: "custom",
				message:
					"Choose an existing client or enter a new client before starting.",
			});
		}
		if (
			value.purpose === "GENERAL_KNOWLEDGE" &&
			(value.companyId || value.newClient)
		) {
			context.addIssue({
				code: "custom",
				message: "General knowledge sessions cannot be linked to a client.",
			});
		}
	});

const assistantFileInput = z.object({
	name: z.string().trim().min(1).max(255),
	mediaType: z.string().trim().min(1).max(160),
	contentBase64: z.string().min(1).max(30_000_000),
});

export const invoiceAssistantMessageInput = z.object({
	sessionId: z.string().min(1),
	prompt: z.string().trim().min(1).max(20_000),
	files: z.array(assistantFileInput).max(12),
});

export const invoiceAssistantSessionInput = z.object({ id: z.string().min(1) });

export const invoiceAssistantApproveInput = z.object({
	actionId: z.string().min(1),
	payload: z.record(z.string(), z.unknown()).optional(),
});
