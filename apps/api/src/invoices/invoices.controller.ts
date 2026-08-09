import {
	Controller,
	ForbiddenException,
	Get,
	Headers,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { InvoicesService } from "./invoices.service";

@Controller("internal/invoices")
export class InvoicesController {
	private readonly secret: string | undefined;

	constructor(
		private readonly invoices: InvoicesService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("CRON_SECRET", { infer: true });
	}

	@Get("process")
	@AllowAnonymous()
	async process(@Headers("authorization") authorization?: string) {
		if (!this.secret)
			throw new ServiceUnavailableException(
				"Billing automation is not configured.",
			);
		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`))
			throw new ForbiddenException();
		return this.invoices.processBillingAutomation();
	}
}

function timingSafeEquals(a: string, b: string) {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1)
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return mismatch === 0;
}
