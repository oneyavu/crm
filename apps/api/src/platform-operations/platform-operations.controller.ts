import { PlatformKind } from "@crm/db";
import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Get,
	Headers,
	HttpCode,
	Logger,
	Param,
	Post,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import {
	platformEventInput,
	websiteInquiryInput,
} from "./platform-operations.contracts";
import { PlatformOperationsService } from "./platform-operations.service";
import { constantTimeEqual, validWebhookSignature } from "./webhook-signature";

@Controller("webhooks/vayu")
@AllowAnonymous()
export class PlatformOperationsWebhookController {
	private readonly intakeSecret?: string;
	private readonly connectorSecret?: string;

	constructor(
		private readonly operations: PlatformOperationsService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.intakeSecret = config.get("WEBSITE_INTAKE_WEBHOOK_SECRET", {
			infer: true,
		});
		this.connectorSecret = config.get("PLATFORM_CONNECTOR_WEBHOOK_SECRET", {
			infer: true,
		});
	}

	@Post("inquiries/website")
	@HttpCode(202)
	website(
		@Body() body: unknown,
		@Headers("x-vayu-timestamp") timestamp?: string,
		@Headers("x-vayu-signature") signature?: string,
	) {
		verifySigned(body, timestamp, signature, this.intakeSecret);
		return this.operations.receiveWebsiteInquiry(
			websiteInquiryInput.parse(body),
		);
	}

	@Post("platforms/:kind/events")
	@HttpCode(202)
	platformEvent(
		@Param("kind") kind: string,
		@Body() body: unknown,
		@Headers("x-vayu-timestamp") timestamp?: string,
		@Headers("x-vayu-signature") signature?: string,
	) {
		verifySigned(body, timestamp, signature, this.connectorSecret);
		const platform = platformKind(kind);
		return this.operations.receivePlatformEvent(
			platform,
			platformEventInput.parse(body),
		);
	}
}

@Controller("internal/platform-operations")
@AllowAnonymous()
export class PlatformOperationsCronController {
	private readonly logger = new Logger(PlatformOperationsCronController.name);
	private readonly secret?: string;

	constructor(
		private readonly operations: PlatformOperationsService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("CRON_SECRET", { infer: true });
	}

	@Get("health")
	health(@Headers("authorization") authorization?: string) {
		this.authorize(authorization);
		return this.operations.checkHealth();
	}

	@Get("daily-brief")
	dailyBrief(@Headers("authorization") authorization?: string) {
		this.authorize(authorization);
		return this.operations.dailyBrief();
	}

	private authorize(authorization?: string) {
		if (!this.secret) {
			this.logger.error({
				message: "CRON_SECRET is not set; refusing platform operations job.",
			});
			throw new ServiceUnavailableException(
				"Platform operations jobs are not configured.",
			);
		}
		if (!constantTimeEqual(authorization ?? "", `Bearer ${this.secret}`))
			throw new ForbiddenException();
	}
}

function verifySigned(
	body: unknown,
	timestamp: string | undefined,
	signature: string | undefined,
	secret: string | undefined,
) {
	if (!secret)
		throw new ServiceUnavailableException("Webhook signing is not configured.");
	if (!timestamp || !signature)
		throw new UnauthorizedException("Signed webhook headers are required.");
	if (!validWebhookSignature({ body, timestamp, signature, secret }))
		throw new UnauthorizedException("Invalid webhook signature.");
}

function platformKind(value: string) {
	const normalized = value.trim().toUpperCase();
	if (!(normalized in PlatformKind))
		throw new BadRequestException("Unknown VAYU platform.");
	return PlatformKind[normalized as keyof typeof PlatformKind];
}
