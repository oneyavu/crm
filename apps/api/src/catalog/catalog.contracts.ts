import { CatalogItemKind } from "@crm/db";
import { z } from "zod";

export const catalogListInput = z.object({
	q: z.string().default(""),
	kind: z
		.enum(
			Object.values(CatalogItemKind) as [CatalogItemKind, ...CatalogItemKind[]],
		)
		.nullable()
		.optional(),
});

export const catalogIdInput = z.object({ id: z.string().min(1) });

export const catalogCreateInput = z.object({
	code: z.string().trim().min(1),
	name: z.string().trim().min(1),
	kind: z.enum(
		Object.values(CatalogItemKind) as [CatalogItemKind, ...CatalogItemKind[]],
	),
	category: z.string().trim().min(1),
	summary: z.string().trim().min(1),
	sourceUrl: z.string().url().or(z.literal("https://onevayu.com")),
});
