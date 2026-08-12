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
	actionDecisionInput,
	actionRequestInput,
	connectionUpdateInput,
	inquiryListInput,
	inquiryUpdateInput,
	platformKindInput,
	writeAccessInput,
} from "./platform-operations.contracts";
import { PlatformOperationsService } from "./platform-operations.service";

@Router({ alias: "platformOperations" })
@UseMiddlewares(AuthMiddleware)
export class PlatformOperationsRouter {
	constructor(
		@Inject(PlatformOperationsService)
		private readonly operations: PlatformOperationsService,
	) {}

	@Query()
	dashboard(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.dashboard(ctx.user.id);
	}

	@Query({ input: inquiryListInput })
	inquiries(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inquiryListInput>,
	) {
		return this.operations.inquiries(input, ctx.user.id);
	}

	@Query()
	actions(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.actions(ctx.user.id);
	}

	@Mutation({ input: inquiryUpdateInput })
	updateInquiry(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inquiryUpdateInput>,
	) {
		return this.operations.updateInquiry(input, ctx.user.id);
	}

	@Mutation({ input: connectionUpdateInput })
	saveConnection(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof connectionUpdateInput>,
	) {
		return this.operations.saveConnection(input, ctx.user.id);
	}

	@Mutation()
	checkHealth(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.checkHealth(ctx.user.id);
	}

	@Mutation({ input: platformKindInput })
	markReadOnlyVerified(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("kind") kind: z.infer<typeof platformKindInput>["kind"],
	) {
		return this.operations.markReadOnlyVerified(kind, ctx.user.id);
	}

	@Mutation({ input: writeAccessInput })
	setWriteAccess(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof writeAccessInput>,
	) {
		return this.operations.setWriteAccess(
			input.kind,
			input.enabled,
			input.confirmation,
			ctx.user.id,
		);
	}

	@Mutation({ input: actionRequestInput })
	requestAction(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof actionRequestInput>,
	) {
		return this.operations.requestAction(input, ctx.user.id);
	}

	@Mutation({ input: actionDecisionInput })
	decideAction(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof actionDecisionInput>,
	) {
		return this.operations.decideAction(input.id, input.decision, ctx.user.id);
	}
}
