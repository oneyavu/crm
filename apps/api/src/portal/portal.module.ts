import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrpcModule } from "../trpc/trpc.module";
import { PortalRouter } from "./portal.router";
import { PortalService } from "./portal.service";

@Module({
	imports: [AiModule, NotificationsModule, TrpcModule],
	providers: [PortalRouter, PortalService],
})
export class PortalModule {}
