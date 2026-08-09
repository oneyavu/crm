import { Module } from "@nestjs/common";
import { FirefliesClient } from "./fireflies.client";
import { FirefliesController } from "./fireflies.controller";
import { FirefliesService } from "./fireflies.service";

@Module({
	controllers: [FirefliesController],
	providers: [FirefliesClient, FirefliesService],
	exports: [FirefliesService],
})
export class FirefliesModule {}
