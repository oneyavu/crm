import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Headers,
	Param,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { PaperclipService } from "./paperclip.service";

type JsonObject = Record<string, unknown>;

@Controller("internal/paperclip/bridge")
@AllowAnonymous()
export class PaperclipBridgeController {
	private readonly secret?: string;

	constructor(
		private readonly paperclip: PaperclipService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("PAPERCLIP_BRIDGE_SECRET", { infer: true });
	}

	@Get("outbox")
	outbox(@Headers("authorization") authorization?: string): Promise<unknown> {
		this.authorize(authorization);
		return this.paperclip.bridgeOutbox();
	}

	@Post("snapshot")
	snapshot(
		@Headers("authorization") authorization: string | undefined,
		@Body() body: JsonObject,
	) {
		this.authorize(authorization);
		return this.paperclip.bridgeSnapshot(body);
	}

	@Post("outbox/:id")
	complete(
		@Headers("authorization") authorization: string | undefined,
		@Param("id") id: string,
		@Body() body: { error?: string },
	) {
		this.authorize(authorization);
		return this.paperclip.bridgeComplete(id, body.error);
	}

	private authorize(authorization?: string) {
		if (!this.secret) throw new ServiceUnavailableException("Bridge not configured.");
		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}
	}
}

function timingSafeEquals(a: string, b: string) {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return mismatch === 0;
}
