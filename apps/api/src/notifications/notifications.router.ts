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
	notificationIdInput,
	notificationListInput,
} from "./notifications.contracts";
import { NotificationsService } from "./notifications.service";

@Router({ alias: "notifications" })
@UseMiddlewares(AuthMiddleware)
export class NotificationsRouter {
	constructor(
		@Inject(NotificationsService)
		private readonly notifications: NotificationsService,
	) {}

	@Query({ input: notificationListInput })
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof notificationListInput>,
	) {
		return this.notifications.list(ctx.user.id, input.limit);
	}

	@Query()
	async unreadCount(@Ctx() ctx: AuthedTrpcContext) {
		return this.notifications.unreadCount(ctx.user.id);
	}

	@Mutation({ input: notificationIdInput })
	async markRead(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.notifications.markRead(ctx.user.id, id);
	}

	@Mutation()
	async markAllRead(@Ctx() ctx: AuthedTrpcContext) {
		return this.notifications.markAllRead(ctx.user.id);
	}
}
