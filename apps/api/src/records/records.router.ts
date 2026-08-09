import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	recordCreateInput,
	recordIdInput,
	recordListInput,
	recordUpdateInput,
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
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recordCreateInput>,
	) {
		return this.records.create(input, ctx.user.id);
	}

	@Mutation({ input: recordUpdateInput })
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recordUpdateInput>,
	) {
		return this.records.update(input, ctx.user.id);
	}

	@Mutation({ input: recordIdInput })
	async delete(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.records.delete(id, ctx.user.id);
	}
}
