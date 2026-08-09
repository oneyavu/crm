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
	invoiceAssistantApproveInput,
	invoiceAssistantMessageInput,
	invoiceAssistantSessionInput,
	invoiceAssistantStartInput,
	invoiceCreateInput,
	invoiceDuplicateInput,
	invoiceIdInput,
	invoiceListInput,
	invoiceScheduleInput,
	invoiceStatusInput,
} from "./invoices.contracts";
import { InvoicesService } from "./invoices.service";

@Router({ alias: "invoices" })
@UseMiddlewares(AuthMiddleware)
export class InvoicesRouter {
	constructor(
		@Inject(InvoicesService) private readonly invoices: InvoicesService,
	) {}

	@Query({ input: invoiceListInput })
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceListInput>,
	) {
		return this.invoices.list(input, ctx.user.id);
	}

	@Query({ input: invoiceIdInput })
	async byId(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.invoices.byId(id, ctx.user.id);
	}

	@Mutation({ input: invoiceCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateInput>,
	) {
		return this.invoices.create(input, ctx.user.id);
	}

	@Mutation({ input: invoiceIdInput })
	async send(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.invoices.send(id, ctx.user.id);
	}

	@Mutation({ input: invoiceStatusInput })
	async setStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceStatusInput>,
	) {
		return this.invoices.setStatus(input.id, input.status, ctx.user.id);
	}

	@Mutation({ input: invoiceIdInput })
	async delete(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.invoices.delete(id, ctx.user.id);
	}

	@Mutation({ input: invoiceDuplicateInput })
	async duplicate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceDuplicateInput>,
	) {
		return this.invoices.duplicate(
			input.id,
			ctx.user.id,
			input.issueDate,
			input.dueDate,
		);
	}

	@Mutation({ input: invoiceScheduleInput })
	async saveSchedule(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceScheduleInput>,
	) {
		return this.invoices.saveSchedule(input, ctx.user.id);
	}

	@Mutation({ input: invoiceAssistantStartInput })
	startAssistant(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceAssistantStartInput>,
	) {
		return this.invoices.startAssistant(input, ctx.user.id);
	}

	@Query({ input: invoiceAssistantSessionInput })
	assistantSession(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.invoices.assistantSession(id, ctx.user.id);
	}

	@Mutation({ input: invoiceAssistantMessageInput })
	assistantMessage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceAssistantMessageInput>,
	) {
		return this.invoices.assistantMessage(input, ctx.user.id);
	}

	@Mutation({ input: invoiceAssistantApproveInput })
	approveAssistantAction(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceAssistantApproveInput>,
	) {
		return this.invoices.approveAssistantAction(input, ctx.user.id);
	}
}
