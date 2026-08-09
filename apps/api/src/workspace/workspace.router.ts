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
	invitationInput,
	inviteMemberInput,
	memberIdInput,
	memberListInput,
	setMemberRoleInput,
	updateWorkspaceInput,
} from "./workspace.contracts";
import { WorkspaceService } from "./workspace.service";

@Router({ alias: "workspace" })
@UseMiddlewares(AuthMiddleware)
export class WorkspaceRouter {
	constructor(
		@Inject(WorkspaceService) private readonly workspace: WorkspaceService,
	) {}

	@Query()
	async get(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.get(ctx.user.id);
	}

	@Query({ input: memberListInput })
	async members(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof memberListInput>,
	) {
		return this.workspace.members(ctx.user.id, input);
	}

	@Mutation({ input: updateWorkspaceInput })
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateWorkspaceInput>,
	) {
		return this.workspace.update(ctx.user.id, input);
	}

	@Mutation({ input: setMemberRoleInput })
	async setMemberRole(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setMemberRoleInput>,
	) {
		return this.workspace.setMemberRole(ctx.user.id, input);
	}

	@Mutation({ input: memberIdInput })
	async removeMember(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("memberId") memberId: string,
	) {
		return this.workspace.removeMember(ctx.user.id, memberId);
	}

	@Query()
	async invitations(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.invitations(ctx.user.id);
	}

	@Mutation({ input: inviteMemberInput })
	async inviteMember(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inviteMemberInput>,
	) {
		return this.workspace.inviteMember(ctx.user.id, input);
	}

	@Mutation({ input: invitationInput })
	async revokeInvitation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("id") id: string,
	) {
		return this.workspace.revokeInvitation(ctx.user.id, id);
	}

	@Mutation({ input: invitationInput })
	async acceptInvitation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("id") id: string,
	) {
		return this.workspace.acceptInvitation(ctx.user, id);
	}
}
