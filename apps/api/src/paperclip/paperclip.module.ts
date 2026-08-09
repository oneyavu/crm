import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { PaperclipRouter } from "./paperclip.router";
import { PaperclipService } from "./paperclip.service";

@Module({
	imports: [TrpcModule],
	providers: [PaperclipService, PaperclipRouter],
	exports: [PaperclipService],
})
export class PaperclipModule {}
