import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { CompaniesModule } from "../companies/companies.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrpcModule } from "../trpc/trpc.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesRouter } from "./invoices.router";
import { InvoicesService } from "./invoices.service";

@Module({
	imports: [TrpcModule, NotificationsModule, AiModule, CompaniesModule],
	providers: [InvoicesService, InvoicesRouter],
	controllers: [InvoicesController],
})
export class InvoicesModule {}
