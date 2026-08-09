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
	clientAccountInput,
	clientContactInput,
	clientContactDeleteInput,
	clientIdInput,
	clientListInput,
} from "./clients.contracts";
import { ClientsService } from "./clients.service";

@Router({ alias: "clients" })
@UseMiddlewares(AuthMiddleware)
export class ClientsRouter {
	constructor(
		@Inject(ClientsService) private readonly clients: ClientsService,
	) {}
	@Query({ input: clientListInput }) list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof clientListInput>,
	) {
		return this.clients.list(input.q, ctx.user.id);
	}
	@Query({ input: clientIdInput }) detail(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("id") id: string,
	) {
		return this.clients.detail(id, ctx.user.id);
	}
	@Mutation({ input: clientAccountInput }) createAccount(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof clientAccountInput>,
	) {
		return this.clients.createAccount(input, ctx.user.id);
	}
	@Mutation({ input: clientContactInput }) addContact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof clientContactInput>,
	) {
		return this.clients.addContact(input, ctx.user.id);
	}
	@Mutation({ input: clientContactDeleteInput }) deleteContact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof clientContactDeleteInput>,
	) {
		return this.clients.deleteContact(input, ctx.user.id);
	}
}
