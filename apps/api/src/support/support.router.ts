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
	saveWidgetInput,
	supportConversationInput,
	supportFormalizeInput,
	supportReplyInput,
	updateSupportConversationInput,
} from "./support.contracts";
import { SupportService } from "./support.service";

@Router({ alias: "support" })
@UseMiddlewares(AuthMiddleware)
export class SupportRouter {
	constructor(
		@Inject(SupportService) private readonly support: SupportService,
	) {}

	@Query()
	async widget(@Ctx() ctx: AuthedTrpcContext) {
		return this.support.widget(ctx.user.id);
	}

	@Mutation({ input: saveWidgetInput })
	async saveWidget(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof saveWidgetInput>,
	) {
		return this.support.saveWidget(input, ctx.user.id);
	}

	@Query()
	async conversations(@Ctx() ctx: AuthedTrpcContext) {
		return this.support.conversations(ctx.user.id);
	}

	@Mutation({ input: updateSupportConversationInput })
	async updateConversation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateSupportConversationInput>,
	) {
		return this.support.updateConversation(input.id, input.status, ctx.user.id);
	}

	@Mutation({ input: supportReplyInput })
	async reply(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof supportReplyInput>,
	) {
		return this.support.agentReply(input.id, input.message, ctx.user.id);
	}

	@Mutation({ input: supportFormalizeInput })
	async createServiceRequest(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("id") id: string,
	) {
		return this.support.createServiceRequest(id, ctx.user.id);
	}

	@Query({ input: supportConversationInput })
	async conversation(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		const conversations = await this.support.conversations(ctx.user.id);
		return conversations.find((conversation) => conversation.id === id) ?? null;
	}
}
