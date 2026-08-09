import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrpcModule } from "../trpc/trpc.module";
import { WorkspaceRouter } from "./workspace.router";
import { WorkspaceService } from "./workspace.service";

@Module({
	imports: [AgentModule, NotificationsModule, TrpcModule],
	providers: [WorkspaceService, WorkspaceRouter],
	exports: [WorkspaceService],
})
export class WorkspaceModule {}
