import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	paymentAccountCurrencyInput,
	setAgentModelInput,
	setResearchKeyInput,
	upsertPaymentAccountInput,
} from "./settings.contracts";
import { SettingsService } from "./settings.service";

@Router({ alias: "settings" })
@UseMiddlewares(AuthMiddleware)
export class SettingsRouter {
	constructor(
		@Inject(SettingsService) private readonly settings: SettingsService,
	) {}

	@Query()
	async agentModel() {
		return this.settings.agentModel();
	}

	@Query()
	async modelCatalog() {
		return this.settings.modelCatalog();
	}

	@Mutation({ input: setAgentModelInput })
	async setAgentModel(@Input() input: z.infer<typeof setAgentModelInput>) {
		return this.settings.setAgentModel(input.modelId);
	}

	@Query()
	async researchKey() {
		return this.settings.researchKey();
	}

	@Mutation({ input: setResearchKeyInput })
	async setResearchKey(@Input() input: z.infer<typeof setResearchKeyInput>) {
		return this.settings.setResearchKey(input.apiKey);
	}

	@Query()
	async paymentAccounts(@Ctx() ctx: AuthedTrpcContext) {
		return this.settings.paymentAccounts(ctx.user.id);
	}

	@Mutation({ input: upsertPaymentAccountInput })
	async upsertPaymentAccount(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof upsertPaymentAccountInput>,
	) {
		return this.settings.upsertPaymentAccount(input, ctx.user.id);
	}

	@Mutation({ input: paymentAccountCurrencyInput })
	async removePaymentAccount(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof paymentAccountCurrencyInput>,
	) {
		return this.settings.removePaymentAccount(input.currency, ctx.user.id);
	}
}
