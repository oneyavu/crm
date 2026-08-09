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
