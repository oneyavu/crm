import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrpcModule } from "../trpc/trpc.module";
import { ProjectsRouter } from "./projects.router";
import { ProjectsService } from "./projects.service";

@Module({
	imports: [TrpcModule, NotificationsModule],
	providers: [ProjectsService, ProjectsRouter],
	exports: [ProjectsService],
})
export class ProjectsModule {}
