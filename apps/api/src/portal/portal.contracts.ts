import { z } from "zod";

export const portalCompanyInput = z.object({ companyId: z.string().min(1) });

export const portalGrantInput = z.object({
	companyId: z.string().min(1),
	contactId: z.string().min(1).nullable().optional(),
	email: z.string().email(),
});

export const portalAccessInput = z.object({ id: z.string().min(1) });
