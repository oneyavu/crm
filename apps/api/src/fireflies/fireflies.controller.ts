import { createHmac, timingSafeEqual } from "node:crypto";
import {
	BadRequestException,
	Controller,
	Headers,
	HttpCode,
	Post,
	Req,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { FirefliesService } from "./fireflies.service";

@Controller("webhooks/fireflies")
export class FirefliesController {
	constructor(
		private readonly config: ConfigService,
		private readonly fireflies: FirefliesService,
	) {}

	@Post()
	@HttpCode(202)
	async receive(
		@Req() request: Request,
		@Headers("x-hub-signature") signature?: string,
	) {
		const secret = this.config.get<string>("FIREFLIES_WEBHOOK_SECRET");
		if (!secret || !this.config.get<string>("FIREFLIES_API_KEY")) {
			throw new ServiceUnavailableException("Fireflies is not configured.");
		}

		const raw = await readBody(request);
		if (!verified(raw, signature, secret)) {
			throw new UnauthorizedException("Invalid Fireflies signature.");
		}

		let event: unknown;
		try {
			event = JSON.parse(raw.toString("utf8"));
		} catch {
			throw new BadRequestException("Invalid webhook JSON.");
		}

		if (!isSummaryEvent(event)) return { accepted: true, ignored: true };
		const result = await this.fireflies.importSummary(event.meeting_id);
		return { accepted: true, routed: Boolean(result.companyId) };
	}
}

async function readBody(request: Request): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

function verified(raw: Buffer, signature: string | undefined, secret: string) {
	if (!signature) return false;
	const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
	const received = Buffer.from(signature);
	const calculated = Buffer.from(expected);
	return (
		received.length === calculated.length &&
		timingSafeEqual(received, calculated)
	);
}

function isSummaryEvent(
	value: unknown,
): value is { event: "meeting.summarized"; meeting_id: string } {
	if (!value || typeof value !== "object") return false;
	const event = value as Record<string, unknown>;
	return (
		event.event === "meeting.summarized" &&
		typeof event.meeting_id === "string" &&
		event.meeting_id.length > 0
	);
}
