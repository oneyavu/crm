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
	invoiceCreateInput,
	invoiceIdInput,
	invoiceListInput,
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
	async list(@Input() input: z.infer<typeof invoiceListInput>) {
		return this.invoices.list(input);
	}

	@Query({ input: invoiceIdInput })
	async byId(@Input("id") id: string) {
		return this.invoices.byId(id);
	}

	@Mutation({ input: invoiceCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateInput>,
	) {
		return this.invoices.create(input, ctx.user.id);
	}

	@Mutation({ input: invoiceIdInput })
	async send(@Input("id") id: string) {
		return this.invoices.send(id);
	}

	@Mutation({ input: invoiceStatusInput })
	async setStatus(@Input() input: z.infer<typeof invoiceStatusInput>) {
		return this.invoices.setStatus(input.id, input.status);
	}
}
