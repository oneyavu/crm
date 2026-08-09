import { z } from "zod";

export const clientListInput = z.object({ q: z.string().default("") });
export const clientIdInput = z.object({ id: z.string().min(1) });
export const clientAccountInput = z.object({
	name: z.string().trim().min(1).max(200),
	domain: z.string().trim().min(3).max(255),
	phone: z.string().trim().max(80).nullable().optional(),
	industry: z.string().trim().max(160).nullable().optional(),
	contactFirstName: z.string().trim().min(1).max(120),
	contactLastName: z.string().trim().max(120).nullable().optional(),
	contactEmail: z.string().email(),
	contactPhone: z.string().trim().max(80).nullable().optional(),
	contactTitle: z.string().trim().max(160).nullable().optional(),
	sendInvite: z.boolean().default(true),
});
export const clientContactInput = z.object({
	companyId: z.string().min(1),
	firstName: z.string().trim().min(1).max(120),
	lastName: z.string().trim().max(120).nullable().optional(),
	email: z.string().email(),
	phone: z.string().trim().max(80).nullable().optional(),
	title: z.string().trim().max(160).nullable().optional(),
	primary: z.boolean().default(false),
	sendInvite: z.boolean().default(false),
});
