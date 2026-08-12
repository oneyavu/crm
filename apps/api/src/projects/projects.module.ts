import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrpcModule } from "../trpc/trpc.module";
import { ProjectsRouter } from "./projects.router";
import { ProjectsService } from "./projects.service";

@Module({
	imports: [TrpcModule, NotificationsModule, AgentModule],
	providers: [ProjectsService, ProjectsRouter],
	exports: [ProjectsService],
})
export class ProjectsModule {}
