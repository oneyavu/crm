import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { PaperclipBridgeController } from "./paperclip-bridge.controller";
import { PaperclipRouter } from "./paperclip.router";
import { PaperclipService } from "./paperclip.service";

@Module({
	imports: [TrpcModule],
	controllers: [PaperclipBridgeController],
	providers: [PaperclipService, PaperclipRouter],
	exports: [PaperclipService],
})
export class PaperclipModule {}
