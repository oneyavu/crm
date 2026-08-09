import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { CatalogRouter } from "./catalog.router";
import { CatalogService } from "./catalog.service";

@Module({
	imports: [TrpcModule],
	providers: [CatalogService, CatalogRouter],
})
export class CatalogModule {}
