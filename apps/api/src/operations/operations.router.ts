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
	compensationInput,
	dealAnalysisInput,
	dealSheetInput,
	documentInput,
	entityIdInput,
	expenseCategoryInput,
	financialAccountInput,
	forecastInput,
	marketResearchInput,
	messageTemplateInput,
	metricInput,
	pricingInput,
	staffProfileInput,
} from "./operations.contracts";
import { OperationsService } from "./operations.service";

@Router({ alias: "operations" })
@UseMiddlewares(AuthMiddleware)
export class OperationsRouter {
	constructor(
		@Inject(OperationsService) private readonly operations: OperationsService,
	) {}

	@Query() overview(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.overview(ctx.user.id);
	}
	@Query() expenseCategories(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.expenseCategories(ctx.user.id);
	}
	@Query() templates(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.templates(ctx.user.id);
	}
	@Query() financialAccounts(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.financialAccounts(ctx.user.id);
	}
	@Query() staff(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.staff(ctx.user.id);
	}
	@Query() pricing(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.pricing(ctx.user.id);
	}
	@Query() documents(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.documents(ctx.user.id);
	}
	@Query() dealSheets(@Ctx() ctx: AuthedTrpcContext) {
		return this.operations.dealSheets(ctx.user.id);
	}

	@Query({ input: entityIdInput })
	document(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.operations.document(id, ctx.user.id);
	}

	@Mutation({ input: expenseCategoryInput })
	saveExpenseCategory(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof expenseCategoryInput>,
	) {
		return this.operations.saveExpenseCategory(input, ctx.user.id);
	}
	@Mutation({ input: messageTemplateInput })
	saveTemplate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof messageTemplateInput>,
	) {
		return this.operations.saveTemplate(input, ctx.user.id);
	}
	@Mutation({ input: financialAccountInput })
	saveFinancialAccount(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof financialAccountInput>,
	) {
		return this.operations.saveFinancialAccount(input, ctx.user.id);
	}
	@Mutation({ input: staffProfileInput })
	saveStaff(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof staffProfileInput>,
	) {
		return this.operations.saveStaff(input, ctx.user.id);
	}
	@Mutation({ input: compensationInput })
	saveCompensation(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof compensationInput>,
	) {
		return this.operations.saveCompensation(input, ctx.user.id);
	}
	@Mutation({ input: metricInput })
	saveMetric(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof metricInput>,
	) {
		return this.operations.saveMetric(input, ctx.user.id);
	}
	@Mutation({ input: pricingInput })
	savePricing(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof pricingInput>,
	) {
		return this.operations.savePricing(input, ctx.user.id);
	}
	@Mutation({ input: documentInput })
	saveDocument(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof documentInput>,
	) {
		return this.operations.saveDocument(input, ctx.user.id);
	}
	@Mutation({ input: dealAnalysisInput })
	analyzeDeal(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealAnalysisInput>,
	) {
		return this.operations.analyzeDeal(input, ctx.user.id);
	}
	@Mutation({ input: dealSheetInput })
	saveDealSheet(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealSheetInput>,
	) {
		return this.operations.saveDealSheet(input, ctx.user.id);
	}
	@Mutation({ input: marketResearchInput })
	researchMarket(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof marketResearchInput>,
	) {
		return this.operations.researchMarket(input, ctx.user.id);
	}

	@Mutation({ input: forecastInput })
	forecast(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof forecastInput>,
	) {
		return this.operations.forecast(input, ctx.user.id);
	}

	@Mutation({ input: entityIdInput })
	deleteExpenseCategory(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("id") id: string,
	) {
		return this.operations.remove("expenseCategory", id, ctx.user.id);
	}
	@Mutation({ input: entityIdInput })
	deleteTemplate(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.operations.remove("messageTemplate", id, ctx.user.id);
	}
	@Mutation({ input: entityIdInput })
	deleteFinancialAccount(
		@Ctx() ctx: AuthedTrpcContext,
		@Input("id") id: string,
	) {
		return this.operations.remove("financialAccount", id, ctx.user.id);
	}
	@Mutation({ input: entityIdInput })
	deleteStaff(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.operations.remove("staffProfile", id, ctx.user.id);
	}
	@Mutation({ input: entityIdInput })
	deleteCompensation(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.operations.remove("staffCompensationPlan", id, ctx.user.id);
	}
	@Mutation({ input: entityIdInput })
	deleteMetric(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.operations.remove("staffMetric", id, ctx.user.id);
	}
	@Mutation({ input: entityIdInput })
	deleteDocument(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.operations.remove("businessDocument", id, ctx.user.id);
	}
}
