import {
	Body,
	Controller,
	Get,
	Headers,
	Param,
	Post,
	Query,
} from "@nestjs/common";
import { publicWidgetChatInput } from "./support.contracts";
import { SupportService } from "./support.service";

@Controller("public/support/widgets")
export class SupportController {
	constructor(private readonly support: SupportService) {}

	@Get(":publicKey")
	async widget(
		@Param("publicKey") publicKey: string,
		@Query("host") host?: string,
		@Headers("origin") origin?: string,
	) {
		return this.support.publicWidget(publicKey, host ?? origin);
	}

	@Post(":publicKey/chat")
	async chat(@Param("publicKey") publicKey: string, @Body() body: unknown) {
		return this.support.publicChat(
			publicKey,
			publicWidgetChatInput.parse(body),
		);
	}
}
