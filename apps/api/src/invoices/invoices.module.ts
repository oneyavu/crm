import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { TrpcModule } from "../trpc/trpc.module";
import { InvoicesRouter } from "./invoices.router";
import { InvoicesService } from "./invoices.service";

@Module({
	imports: [TrpcModule, NotificationsModule],
	providers: [InvoicesService, InvoicesRouter],
})
export class InvoicesModule {}
