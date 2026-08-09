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
	projectCreateInput,
	projectIdInput,
	projectListInput,
	projectTaskCreateInput,
	projectTaskIdInput,
	projectTaskUpdateInput,
	projectUpdateInput,
} from "./projects.contracts";
import { ProjectsService } from "./projects.service";

@Router({ alias: "projects" })
@UseMiddlewares(AuthMiddleware)
export class ProjectsRouter {
	constructor(
		@Inject(ProjectsService) private readonly projects: ProjectsService,
	) {}

	@Query({ input: projectListInput })
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof projectListInput>,
	) {
		return this.projects.list(input, ctx.user.id);
	}

	@Query({ input: projectIdInput })
	async byId(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.projects.byId(id, ctx.user.id);
	}

	@Query()
	async options(@Ctx() ctx: AuthedTrpcContext) {
		return this.projects.options(ctx.user.id);
	}

	@Mutation({ input: projectCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof projectCreateInput>,
	) {
		return this.projects.create(input, ctx.user.id);
	}

	@Mutation({ input: projectUpdateInput })
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof projectUpdateInput>,
	) {
		return this.projects.update(input, ctx.user.id);
	}

	@Mutation({ input: projectIdInput })
	async delete(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.projects.delete(id, ctx.user.id);
	}

	@Mutation({ input: projectTaskCreateInput })
	async createTask(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof projectTaskCreateInput>,
	) {
		return this.projects.createTask(input, ctx.user.id);
	}

	@Mutation({ input: projectTaskUpdateInput })
	async updateTask(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof projectTaskUpdateInput>,
	) {
		return this.projects.updateTask(input, ctx.user.id);
	}

	@Mutation({ input: projectTaskIdInput })
	async deleteTask(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.projects.deleteTask(id, ctx.user.id);
	}
}
