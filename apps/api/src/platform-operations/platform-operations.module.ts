import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaperclipModule } from "../paperclip/paperclip.module";
import { TrpcModule } from "../trpc/trpc.module";
import {
	PlatformOperationsCronController,
	PlatformOperationsWebhookController,
} from "./platform-operations.controller";
import { PlatformOperationsRouter } from "./platform-operations.router";
import { PlatformOperationsService } from "./platform-operations.service";

@Module({
	imports: [AgentModule, NotificationsModule, PaperclipModule, TrpcModule],
	controllers: [
		PlatformOperationsWebhookController,
		PlatformOperationsCronController,
	],
	providers: [PlatformOperationsRouter, PlatformOperationsService],
})
export class PlatformOperationsModule {}
