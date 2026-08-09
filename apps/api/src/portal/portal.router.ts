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
	portalAccessInput,
	portalCompanyInput,
	portalGrantInput,
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
}
