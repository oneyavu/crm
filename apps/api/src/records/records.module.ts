import { Module } from "@nestjs/common";
import { RecordsRouter } from "./records.router";
import { RecordsService } from "./records.service";

@Module({ providers: [RecordsRouter, RecordsService] })
export class RecordsModule {}
