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
	createServiceRequestInput,
	portalAccessInput,
	portalAiChatInput,
	portalCompanyInput,
	portalGrantInput,
	portalInviteInput,
	portalLiveChatInput,
	serviceRequestReplyInput,
	serviceRequestStatusInput,
	submitInvoicePaymentInput,
} from "./portal.contracts";
import { PortalService } from "./portal.service";

@Router({ alias: "portal" })
@UseMiddlewares(AuthMiddleware)
export class PortalRouter {
	constructor(@Inject(PortalService) private readonly portal: PortalService) {}

	@Query()
	async mine(@Ctx() ctx: AuthedTrpcContext) {
		return this.portal.mine(ctx.user);
	}

	@Query({ input: portalCompanyInput })
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof portalCompanyInput>,
	) {
		return this.portal.list(input.companyId, ctx.user.id);
	}

	@Mutation({ input: portalGrantInput })
	async grant(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof portalGrantInput>,
	) {
		return this.portal.grant(input, ctx.user.id);
	}

	@Mutation({ input: portalAccessInput })
	async revoke(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.portal.revoke(id, ctx.user.id);
	}

	@Mutation({ input: portalInviteInput })
	async acceptInvite(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("token") token: string,
	) {
		return this.portal.acceptInvite(token, ctx.user);
	}

	@Mutation({ input: createServiceRequestInput })
	async createServiceRequest(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createServiceRequestInput>,
	) {
		return this.portal.createServiceRequest(input, ctx.user);
	}

	@Mutation({ input: serviceRequestReplyInput })
	async replyToServiceRequest(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof serviceRequestReplyInput>,
	) {
		return this.portal.replyToServiceRequest(input, ctx.user);
	}

	@Mutation({ input: serviceRequestStatusInput })
	async setServiceRequestStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof serviceRequestStatusInput>,
	) {
		return this.portal.setServiceRequestStatus(input, ctx.user);
	}

	@Mutation({ input: portalAiChatInput })
	async aiChat(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof portalAiChatInput>,
	) {
		return this.portal.aiChat(input, ctx.user);
	}

	@Mutation({ input: portalLiveChatInput })
	async liveChat(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof portalLiveChatInput>,
	) {
		return this.portal.liveChat(input, ctx.user);
	}

	@Mutation({ input: submitInvoicePaymentInput })
	async submitInvoicePayment(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof submitInvoicePaymentInput>,
	) {
		return this.portal.submitInvoicePayment(input, ctx.user);
	}
}
