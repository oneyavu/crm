import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { PortalRouter } from "./portal.router";
import { PortalService } from "./portal.service";

@Module({
	imports: [TrpcModule],
	providers: [PortalRouter, PortalService],
})
export class PortalModule {}
