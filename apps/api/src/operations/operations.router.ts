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
	documentInput,
	entityIdInput,
	expenseCategoryInput,
	financialAccountInput,
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

	@Query() overview() {
		return this.operations.overview();
	}
	@Query() expenseCategories() {
		return this.operations.expenseCategories();
	}
	@Query() templates() {
		return this.operations.templates();
	}
	@Query() financialAccounts() {
		return this.operations.financialAccounts();
	}
	@Query() staff() {
		return this.operations.staff();
	}
	@Query() pricing() {
		return this.operations.pricing();
	}
	@Query() documents() {
		return this.operations.documents();
	}

	@Query({ input: entityIdInput })
	document(@Input("id") id: string) {
		return this.operations.document(id);
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
