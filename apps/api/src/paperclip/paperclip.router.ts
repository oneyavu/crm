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
	paperclipAgentInput,
	paperclipApprovalInput,
	paperclipInstructionInput,
	paperclipWorkflowInput,
} from "./paperclip.contracts";
import { PaperclipService } from "./paperclip.service";

@Router({ alias: "paperclip" })
@UseMiddlewares(AuthMiddleware)
export class PaperclipRouter {
	constructor(
		@Inject(PaperclipService) private readonly paperclip: PaperclipService,
	) {}
	@Query() async dashboard(@Ctx() ctx: AuthedTrpcContext) {
		await this.paperclip.authorize(ctx.user.id);
		return this.paperclip.dashboard();
	}
	@Query({ input: paperclipAgentInput }) async agent(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("agentId") agentId: string,
	) {
		await this.paperclip.authorize(ctx.user.id);
		return this.paperclip.agent(agentId);
	}
	@Mutation({ input: paperclipInstructionInput }) async instruction(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof paperclipInstructionInput>,
	) {
		await this.paperclip.authorize(ctx.user.id);
		return this.paperclip.instruction(
			input.agentId,
			input.message,
			ctx.user.id,
		);
	}
	@Mutation({ input: paperclipApprovalInput }) async approval(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof paperclipApprovalInput>,
	) {
		await this.paperclip.authorize(ctx.user.id, true);
		return this.paperclip.approval(
			input.approvalId,
			input.action,
			input.note,
			ctx.user.id,
		);
	}
	@Mutation({ input: paperclipWorkflowInput }) async workflow(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof paperclipWorkflowInput>,
	) {
		await this.paperclip.authorize(ctx.user.id, true);
		return this.paperclip.workflow(input.routineId, input.payload, ctx.user.id);
	}
	@Mutation() async sync(@Ctx() ctx: AuthedTrpcContext) {
		await this.paperclip.authorize(ctx.user.id, true);
		return this.paperclip.sync();
	}
}
