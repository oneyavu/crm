import { z } from "zod";

export const setAgentModelInput = z.object({
	modelId: z.string().trim().min(1).max(200).nullable(),
});

export type SetAgentModelInput = z.infer<typeof setAgentModelInput>;

export const setResearchKeyInput = z.object({
	apiKey: z
		.string()
		.trim()
		.min(8, "That does not look like a Context API key — it is too short.")
		.max(500, "That does not look like a Context API key — it is too long.")
		.refine(
			(value) => !/\s/.test(value),
			"An API key has no spaces in it. Paste the whole key on its own.",
		),
});

export type SetResearchKeyInput = z.infer<typeof setResearchKeyInput>;

export const upsertPaymentAccountInput = z.object({
	id: z.string().trim().min(1).optional(),
	currency: z.enum(["USD", "JMD"]),
	label: z.string().trim().min(2).max(100),
	bankName: z.string().trim().min(2).max(160),
	bankAddress: z.string().trim().max(240).nullable().optional(),
	branchName: z.string().trim().max(160).nullable().optional(),
	accountName: z.string().trim().min(2).max(160),
	accountNumber: z.string().trim().min(2).max(80),
	accountType: z.string().trim().max(100).nullable().optional(),
	swiftCode: z.string().trim().max(40).nullable().optional(),
	branchCode: z.string().trim().max(40).nullable().optional(),
	routingNumber: z.string().trim().max(40).nullable().optional(),
	conversion: z.string().trim().max(100).nullable().optional(),
	destination: z.string().trim().max(160).nullable().optional(),
	active: z.boolean(),
});

export const paymentAccountIdInput = z.object({
	id: z.string().trim().min(1),
});
