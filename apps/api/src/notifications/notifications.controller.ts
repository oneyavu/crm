import {
	Controller,
	ForbiddenException,
	Get,
	Headers,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { NotificationsService } from "./notifications.service";

@Controller("internal/notifications")
export class NotificationsController {
	private readonly logger = new Logger(NotificationsController.name);
	private readonly secret: string | undefined;

	constructor(
		private readonly notifications: NotificationsService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("CRON_SECRET", { infer: true });
	}

	@Get("send")
	@AllowAnonymous()
	async send(@Headers("authorization") authorization?: string) {
		if (!this.secret) {
			this.logger.error({
				message: "CRON_SECRET is not set; refusing notification dispatch.",
			});
			throw new ServiceUnavailableException(
				"Notification dispatch is not configured.",
			);
		}

		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}

		return this.notifications.dispatchDue();
	}
}

function timingSafeEquals(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}

	return mismatch === 0;
}
