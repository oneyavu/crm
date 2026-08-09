import { Inject } from "@nestjs/common";
import { Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { catalogListInput } from "./catalog.contracts";
import { CatalogService } from "./catalog.service";

@Router({ alias: "catalog" })
@UseMiddlewares(AuthMiddleware)
export class CatalogRouter {
	constructor(
		@Inject(CatalogService) private readonly catalog: CatalogService,
	) {}

	@Query({ input: catalogListInput })
	async list(@Input() input: z.infer<typeof catalogListInput>) {
		return this.catalog.list(input);
	}
}
