import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	recordCreateInput,
	recordIdInput,
	recordListInput,
} from "./records.contracts";
import { RecordsService } from "./records.service";

@Router({ alias: "records" })
@UseMiddlewares(AuthMiddleware)
export class RecordsRouter {
	constructor(
		@Inject(RecordsService) private readonly records: RecordsService,
	) {}

	@Query({ input: recordListInput })
	async list(@Input() input: z.infer<typeof recordListInput>) {
		return this.records.list(input);
	}

	@Mutation({ input: recordCreateInput })
	async create(@Input() input: z.infer<typeof recordCreateInput>) {
		return this.records.create(input);
	}

	@Mutation({ input: recordIdInput })
	async delete(@Input("id") id: string) {
		return this.records.delete(id);
	}
}
