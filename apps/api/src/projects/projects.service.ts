import {
	type Db,
	NotificationType,
	type Prisma,
	Prisma as PrismaNamespace,
	ProjectStatus,
	ProjectTaskStatus,
} from "@crm/db";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { blankToNull, decimalFromCents, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { NotificationsService } from "../notifications/notifications.service";
import {
	countsByKey,
	FACET_ALL,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	ProjectCreateInput,
	ProjectListInput,
	ProjectTaskCreateInput,
	ProjectTaskUpdateInput,
	ProjectUpdateInput,
} from "./projects.contracts";

const USER_SELECT = { id: true, name: true, email: true, image: true } as const;

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.ProjectOrderByWithRelationInput
> = {
	name: (dir) => ({ name: dir }),
	status: (dir) => ({ status: dir }),
	owner: (dir) => ({ owner: { name: dir } }),
	company: (dir) => ({ company: { name: dir } }),
	dueDate: (dir) => ({ dueDate: { sort: dir, nulls: "last" } }),
	createdAt: (dir) => ({ createdAt: dir }),
};

@Injectable()
export class ProjectsService {
	private readonly logger = new Logger(ProjectsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly notifications: NotificationsService,
	) {}

	async list(input: ProjectListInput) {
		const where = this.where(input);
		const { skip, take } = paginate(input);
		const baseWhere = this.search(input.q);

		const [rows, total, statuses, owners] = await Promise.all([
			this.db.project.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "desc" }),
				select: {
					id: true,
					name: true,
					status: true,
					dueDate: true,
					budget: true,
					currency: true,
					createdAt: true,
					company: { select: { id: true, name: true } },
					owner: { select: USER_SELECT },
					_count: { select: { tasks: true } },
					tasks: {
						where: { status: ProjectTaskStatus.DONE },
						select: { id: true },
					},
				},
			}),
			this.db.project.count({ where }),
			this.db.project.groupBy({
				by: ["status"],
				where: baseWhere,
				_count: { _all: true },
			}),
			this.db.project.groupBy({
				by: ["ownerId"],
				where: baseWhere,
				_count: { _all: true },
			}),
		]);

		return {
			rows: rows.map((row) => ({
				id: row.id,
				name: row.name,
				status: row.status,
				dueDate: row.dueDate?.toISOString() ?? null,
				budgetCents: toCents(row.budget),
				currency: row.currency,
				createdAt: row.createdAt.toISOString(),
				company: row.company,
				owner: row.owner,
				taskCount: row._count.tasks,
				completedTaskCount: row.tasks.length,
			})),
			total,
			facetCounts: {
				status: countsByKey(statuses, "status"),
				owner: countsByKey(owners, "ownerId"),
			},
		};
	}

	async byId(id: string) {
		const project = await this.db.project.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				description: true,
				status: true,
				startDate: true,
				dueDate: true,
				budget: true,
				currency: true,
				createdAt: true,
				updatedAt: true,
				company: { select: { id: true, name: true } },
				owner: { select: USER_SELECT },
				members: {
					orderBy: { createdAt: "asc" },
					select: { role: true, user: { select: USER_SELECT } },
				},
				tasks: {
					orderBy: [
						{ status: "asc" },
						{ position: "asc" },
						{ createdAt: "asc" },
					],
					select: {
						id: true,
						title: true,
						description: true,
						status: true,
						priority: true,
						position: true,
						dueDate: true,
						completedAt: true,
						assignee: { select: USER_SELECT },
						createdAt: true,
					},
				},
			},
		});
		if (!project) throw new NotFoundException(`No project with id ${id}.`);

		return {
			...project,
			budget: undefined,
			budgetCents: toCents(project.budget),
			startDate: project.startDate?.toISOString() ?? null,
			dueDate: project.dueDate?.toISOString() ?? null,
			createdAt: project.createdAt.toISOString(),
			updatedAt: project.updatedAt.toISOString(),
			tasks: project.tasks.map((task) => ({
				...task,
				dueDate: task.dueDate?.toISOString() ?? null,
				completedAt: task.completedAt?.toISOString() ?? null,
				createdAt: task.createdAt.toISOString(),
			})),
		};
	}

	async options() {
		return this.db.project.findMany({
			where: { status: { not: ProjectStatus.CANCELLED } },
			select: { id: true, name: true, companyId: true },
			orderBy: { name: "asc" },
			take: 100,
		});
	}

	async create(input: ProjectCreateInput, actingUserId: string) {
		const project = await this.db.project.create({
			data: {
				name: input.name.trim(),
				description: blankToNull(input.description ?? ""),
				companyId: input.companyId || null,
				ownerId: input.ownerId,
				status: input.status,
				startDate: date(input.startDate),
				dueDate: date(input.dueDate),
				budget: decimalFromCents(input.budgetCents),
				currency: input.currency,
				members: { create: { userId: input.ownerId, role: "Project owner" } },
			},
			select: { id: true, name: true, ownerId: true },
		});

		if (project.ownerId !== actingUserId) {
			await this.notifications.notifyUser({
				userId: project.ownerId,
				type: NotificationType.PROJECT_ASSIGNED,
				title: `Project assigned: ${project.name}`,
				body: "You are responsible for this project.",
				href: `/projects/${project.id}`,
				projectId: project.id,
			});
		}

		this.logger.log({ message: "Project created", projectId: project.id });
		return project;
	}

	async update(input: ProjectUpdateInput, actingUserId: string) {
		const current = await this.db.project.findUnique({
			where: { id: input.id },
			select: { ownerId: true },
		});
		if (!current)
			throw new NotFoundException(`No project with id ${input.id}.`);

		const project = await this.db.project.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined ? { name: input.name.trim() } : {}),
				...(input.description !== undefined
					? { description: blankToNull(input.description ?? "") }
					: {}),
				...(input.companyId !== undefined
					? { companyId: input.companyId || null }
					: {}),
				...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
				...(input.status !== undefined ? { status: input.status } : {}),
				...(input.startDate !== undefined
					? { startDate: date(input.startDate) }
					: {}),
				...(input.dueDate !== undefined
					? { dueDate: date(input.dueDate) }
					: {}),
				...(input.budgetCents !== undefined
					? { budget: decimalFromCents(input.budgetCents) }
					: {}),
				...(input.currency !== undefined ? { currency: input.currency } : {}),
			},
			select: { id: true, name: true, ownerId: true, status: true },
		});

		if (input.ownerId && input.ownerId !== current.ownerId) {
			await this.db.projectMember.upsert({
				where: {
					projectId_userId: { projectId: project.id, userId: input.ownerId },
				},
				create: {
					projectId: project.id,
					userId: input.ownerId,
					role: "Project owner",
				},
				update: { role: "Project owner" },
			});
		}

		if (project.ownerId !== actingUserId) {
			await this.notifications.notifyUser({
				userId: project.ownerId,
				type: NotificationType.PROJECT_UPDATED,
				title: `Project updated: ${project.name}`,
				body: `The project is now ${project.status.toLowerCase().replaceAll("_", " ")}.`,
				href: `/projects/${project.id}`,
				projectId: project.id,
			});
		}

		return project;
	}

	async delete(id: string) {
		try {
			return await this.db.project.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No project with id ${id}.`);
			}
			throw error;
		}
	}

	async createTask(input: ProjectTaskCreateInput, actingUserId: string) {
		const task = await this.db.projectTask.create({
			data: {
				projectId: input.projectId,
				title: input.title.trim(),
				description: blankToNull(input.description ?? ""),
				assigneeId: input.assigneeId || null,
				status: input.status,
				priority: input.priority,
				dueDate: date(input.dueDate),
				createdById: actingUserId,
				position: await this.db.projectTask.count({
					where: { projectId: input.projectId },
				}),
			},
			select: {
				id: true,
				title: true,
				projectId: true,
				assigneeId: true,
				project: { select: { name: true } },
			},
		});

		if (task.assigneeId && task.assigneeId !== actingUserId) {
			await this.notifications.notifyUser({
				userId: task.assigneeId,
				type: NotificationType.TASK_ASSIGNED,
				title: `Task assigned: ${task.title}`,
				body: `This task belongs to ${task.project.name}.`,
				href: `/projects/${task.projectId}`,
				projectId: task.projectId,
				taskId: task.id,
			});
		}

		return { id: task.id, title: task.title, projectId: task.projectId };
	}

	async updateTask(input: ProjectTaskUpdateInput, actingUserId: string) {
		const task = await this.db.projectTask.update({
			where: { id: input.id },
			data: {
				...(input.title !== undefined ? { title: input.title.trim() } : {}),
				...(input.description !== undefined
					? { description: blankToNull(input.description ?? "") }
					: {}),
				...(input.assigneeId !== undefined
					? { assigneeId: input.assigneeId || null }
					: {}),
				...(input.priority !== undefined ? { priority: input.priority } : {}),
				...(input.dueDate !== undefined
					? { dueDate: date(input.dueDate) }
					: {}),
				...(input.status !== undefined
					? {
							status: input.status,
							completedAt:
								input.status === ProjectTaskStatus.DONE ? new Date() : null,
						}
					: {}),
			},
			select: {
				id: true,
				title: true,
				status: true,
				projectId: true,
				assigneeId: true,
				project: { select: { name: true } },
			},
		});

		if (task.assigneeId && task.assigneeId !== actingUserId) {
			await this.notifications.notifyUser({
				userId: task.assigneeId,
				type: NotificationType.TASK_UPDATED,
				title: `Task updated: ${task.title}`,
				body: `The task is now ${task.status.toLowerCase().replaceAll("_", " ")}.`,
				href: `/projects/${task.projectId}`,
				projectId: task.projectId,
				taskId: task.id,
			});
		}

		return { id: task.id, projectId: task.projectId, status: task.status };
	}

	async deleteTask(id: string) {
		try {
			return await this.db.projectTask.delete({
				where: { id },
				select: { id: true, title: true, projectId: true },
			});
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No task with id ${id}.`);
			}
			throw error;
		}
	}

	private search(q: string): Prisma.ProjectWhereInput {
		const term = q.trim();
		if (!term) return {};
		return {
			OR: [
				{ name: { contains: term, mode: "insensitive" } },
				{ company: { name: { contains: term, mode: "insensitive" } } },
			],
		};
	}

	private where(input: ProjectListInput): Prisma.ProjectWhereInput {
		return {
			...this.search(input.q),
			...(input.status !== FACET_ALL
				? { status: input.status as ProjectStatus }
				: {}),
			...(input.owner !== FACET_ALL ? { ownerId: input.owner } : {}),
		};
	}
}

function date(value: string | null | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
