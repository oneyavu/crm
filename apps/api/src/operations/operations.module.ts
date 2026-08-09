import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { OperationsController } from "./operations.controller";
import { OperationsRouter } from "./operations.router";
import { OperationsService } from "./operations.service";

@Module({
	imports: [AiModule],
	controllers: [OperationsController],
	providers: [OperationsRouter, OperationsService],
})
export class OperationsModule {}
