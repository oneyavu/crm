import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	catalogCreateInput,
	catalogIdInput,
	catalogListInput,
} from "./catalog.contracts";
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

	@Mutation({ input: catalogCreateInput })
	async create(@Input() input: z.infer<typeof catalogCreateInput>) {
		return this.catalog.create(input);
	}

	@Mutation({ input: catalogIdInput })
	async delete(@Input("id") id: string) {
		return this.catalog.delete(id);
	}
}
