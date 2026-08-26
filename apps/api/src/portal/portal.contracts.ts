import { z } from "zod";

export const portalCompanyInput = z.object({ companyId: z.string().min(1) });

export const portalGrantInput = z.object({
	companyId: z.string().min(1),
	contactId: z.string().min(1).nullable().optional(),
	email: z.string().email(),
});

export const portalAccessInput = z.object({ id: z.string().min(1) });
export const portalInviteInput = z.object({ token: z.string().min(1) });

export const createServiceRequestInput = z.object({
	title: z.string().trim().min(3).max(160),
	description: z.string().trim().min(5).max(8_000),
	category: z.enum([
		"SUPPORT",
		"CHANGE_REQUEST",
		"BILLING",
		"ACCESS",
		"INTEGRATION",
		"OTHER",
	]),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
	projectId: z.string().min(1).nullable().optional(),
});

export const serviceRequestReplyInput = z.object({
	requestId: z.string().min(1),
	message: z.string().trim().min(1).max(4_000),
});

export const serviceRequestStatusInput = z.object({
	requestId: z.string().min(1),
	status: z.enum(["OPEN", "CLOSED"]),
});

export const portalAiChatInput = z.object({
	conversationId: z.string().min(1).nullable().optional(),
	message: z.string().trim().min(1).max(4_000),
});

export const portalLiveChatInput = z.object({
	conversationId: z.string().min(1).nullable().optional(),
	message: z.string().trim().min(1).max(4_000),
});

export const submitInvoicePaymentInput = z
	.object({
		invoiceId: z.string().min(1),
		paymentAccountId: z.string().min(1),
		method: z.enum(["CHECK", "RTGS", "ACH", "DIRECT_TRANSFER"]),
		currency: z.enum(["USD", "JMD"]),
		amountCents: z.number().int().positive().optional(),
		transactionId: z.string().trim().max(160).optional(),
		transferredAt: z.string().datetime().optional(),
		senderBank: z.string().trim().max(160).optional(),
		senderBranch: z.string().trim().max(160).optional(),
		attachment: z
			.object({
				name: z.string().trim().min(1).max(180),
				mediaType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
				size: z.number().int().positive().max(5_000_000),
				base64: z.string().min(1).max(7_000_000),
			})
			.optional(),
	})
	.superRefine((value, ctx) => {
		if (
			!value.attachment &&
			(!value.transactionId ||
				!value.transferredAt ||
				!value.senderBank ||
				!value.senderBranch)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Attach proof of payment or provide the transaction ID, time, sender bank and branch.",
			});
		}
	});
