import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { TrpcModule } from "../trpc/trpc.module";
import { SupportController } from "./support.controller";
import { SupportRouter } from "./support.router";
import { SupportService } from "./support.service";

@Module({
	imports: [AiModule, TrpcModule],
	controllers: [SupportController],
	providers: [SupportRouter, SupportService],
	exports: [SupportService],
})
export class SupportModule {}
