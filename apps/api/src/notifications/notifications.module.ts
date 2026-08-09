import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRouter } from "./notifications.router";
import { NotificationsService } from "./notifications.service";

@Module({
	imports: [TrpcModule],
	controllers: [NotificationsController],
	providers: [NotificationsService, NotificationsRouter],
	exports: [NotificationsService],
})
export class NotificationsModule {}
