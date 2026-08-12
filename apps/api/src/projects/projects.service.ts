import {
	type Db,
	NotificationType,
	type Prisma,
	Prisma as PrismaNamespace,
	ProjectStatus,
	ProjectTaskStatus,
} from "@crm/db";
import {
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
} from "@nestjs/common";
import { assignedProjectWhere, staffRole } from "../authz/staff-scope";
import { blankToNull, decimalFromCents, toCents } from "../crm/values";
import { AgentTriggerService } from "../agent/agent-trigger.service";
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
	ProjectPhaseCreateInput,
	ProjectPhaseUpdateInput,
	ProjectTaskCommentCreateInput,
	ProjectTaskCreateInput,
	ProjectTaskDependencyInput,
	ProjectTaskUpdateInput,
	ProjectManagerSyncInput,
	ProjectTimeEntryCreateInput,
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
const PROJECT_MANAGER_BRIDGE_URL =
	process.env.PROJECT_MANAGER_BRIDGE_URL?.trim() ?? "";
const PROJECT_MANAGER_BRIDGE_TOKEN =
	process.env.PROJECT_MANAGER_BRIDGE_TOKEN?.trim();
const PROJECT_MANAGER_BRIDGE_TIMEOUT_MS = 25_000;

@Injectable()
export class ProjectsService {
	private readonly logger = new Logger(ProjectsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly notifications: NotificationsService,
		@Optional() private readonly agent?: AgentTriggerService,
	) {}

	async list(input: ProjectListInput, actorId: string) {
		const access = await staffRole(this.db, actorId);
		const scope = access.admin ? {} : assignedProjectWhere(actorId);
		const where: Prisma.ProjectWhereInput = { AND: [this.where(input), scope] };
		const { skip, take } = paginate(input);
		const baseWhere: Prisma.ProjectWhereInput = {
			AND: [this.search(input.q), scope],
		};

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
				budgetCents: access.admin ? toCents(row.budget) : null,
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

	async byId(id: string, actorId: string) {
		const access = await staffRole(this.db, actorId);
		const project = await this.db.project.findFirst({
			where: {
				id,
				...(access.admin ? {} : assignedProjectWhere(actorId)),
			},
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
				timeEntries: {
					orderBy: { startedAt: "desc" },
					take: 250,
					select: {
						id: true,
						taskId: true,
						description: true,
						minutes: true,
						billable: true,
						approved: true,
						startedAt: true,
						staffUser: { select: USER_SELECT },
					},
				},
				resourceUsage: {
					orderBy: { occurredAt: "desc" },
					take: 250,
					select: {
						id: true,
						taskId: true,
						agentId: true,
						label: true,
						processingMs: true,
						inputTokens: true,
						outputTokens: true,
						estimatedCost: true,
						occurredAt: true,
						metadata: true,
					},
				},
				meetingSummaries: {
					orderBy: { meetingAt: "desc" },
					take: 100,
					select: {
						id: true,
						title: true,
						meetingAt: true,
						durationMinutes: true,
						participantEmails: true,
						summary: true,
						actionItems: true,
						keywords: true,
						transcriptUrl: true,
						visibility: true,
					},
				},
				serviceRequests: {
					orderBy: { updatedAt: "desc" },
					take: 100,
					select: {
						id: true,
						reference: true,
						title: true,
						description: true,
						category: true,
						priority: true,
						status: true,
						resolution: true,
						createdAt: true,
						updatedAt: true,
					},
				},
				businessDocuments: {
					orderBy: { updatedAt: "desc" },
					select: {
						id: true,
						kind: true,
						title: true,
						label: true,
						description: true,
						fileName: true,
						mediaType: true,
						size: true,
						source: true,
						updatedAt: true,
					},
				},
				invoices: {
					orderBy: { issueDate: "desc" },
					select: {
						id: true,
						number: true,
						status: true,
						issueDate: true,
						dueDate: true,
						currency: true,
						total: true,
						amountPaid: true,
					},
				},
				phases: {
					orderBy: { position: "asc" },
					select: {
						id: true,
						name: true,
						color: true,
						position: true,
						startDate: true,
						dueDate: true,
						clientVisible: true,
					},
				},
				milestones: {
					orderBy: { position: "asc" },
					select: {
						id: true,
						title: true,
						dueDate: true,
						completedAt: true,
						clientVisible: true,
					},
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
						startDate: true,
						completedAt: true,
						progress: true,
						estimatedMinutes: true,
						clientVisible: true,
						parentTaskId: true,
						phase: { select: { id: true, name: true, color: true } },
						assignee: { select: USER_SELECT },
						blockedBy: {
							select: {
								blockedBy: { select: { id: true, title: true, status: true } },
							},
						},
						comments: {
							orderBy: { createdAt: "asc" },
							select: {
								id: true,
								body: true,
								internal: true,
								createdAt: true,
								author: { select: USER_SELECT },
							},
						},
						createdAt: true,
					},
				},
			},
		});
		if (!project) throw new NotFoundException(`No project with id ${id}.`);

		return {
			...project,
			budget: undefined,
			budgetCents: access.admin ? toCents(project.budget) : null,
			startDate: project.startDate?.toISOString() ?? null,
			dueDate: project.dueDate?.toISOString() ?? null,
			createdAt: project.createdAt.toISOString(),
			updatedAt: project.updatedAt.toISOString(),
			phases: project.phases.map((phase) => ({
				...phase,
				startDate: phase.startDate?.toISOString() ?? null,
				dueDate: phase.dueDate?.toISOString() ?? null,
			})),
			milestones: project.milestones.map((milestone) => ({
				...milestone,
				dueDate: milestone.dueDate?.toISOString() ?? null,
				completedAt: milestone.completedAt?.toISOString() ?? null,
			})),
			timeEntries: project.timeEntries.map((entry) => ({
				...entry,
				startedAt: entry.startedAt.toISOString(),
			})),
			tasks: project.tasks.map((task) => ({
				...task,
				startDate: task.startDate?.toISOString() ?? null,
				dueDate: task.dueDate?.toISOString() ?? null,
				completedAt: task.completedAt?.toISOString() ?? null,
				createdAt: task.createdAt.toISOString(),
				comments: task.comments.map((comment) => ({
					...comment,
					createdAt: comment.createdAt.toISOString(),
				})),
			})),
		};
	}

	async options(actorId: string) {
		const access = await staffRole(this.db, actorId);
		return this.db.project.findMany({
			where: {
				status: { not: ProjectStatus.CANCELLED },
				...(access.admin ? {} : assignedProjectWhere(actorId)),
			},
			select: { id: true, name: true, companyId: true },
			orderBy: { name: "asc" },
			take: 100,
		});
	}

	async create(input: ProjectCreateInput, actingUserId: string) {
		const access = await staffRole(this.db, actingUserId);
		if (!access.admin)
			throw new ForbiddenException("Project creation requires approval.");
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
		await this.queueProjectWork({
			projectId: project.id,
			projectName: project.name,
			reason: `Project created by staff user ${actingUserId}.`,
			companyId: input.companyId || null,
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
		const access = await staffRole(this.db, actingUserId);
		if (!access.admin) {
			const allowed = await this.db.project.count({
				where: { id: input.id, ...assignedProjectWhere(actingUserId) },
			});
			if (!allowed)
				throw new ForbiddenException("This project is not assigned to you.");
			if (
				input.budgetCents !== undefined ||
				input.currency !== undefined ||
				input.companyId !== undefined ||
				input.ownerId !== undefined
			)
				throw new ForbiddenException(
					"Financial, client and ownership changes require approval.",
				);
		}
		const current = await this.db.project.findUnique({
			where: { id: input.id },
			select: { ownerId: true, companyId: true, name: true },
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
		await this.queueProjectWork({
			projectId: project.id,
			projectName: project.name,
			reason: `Project updated by staff user ${actingUserId}.`,
			companyId: current.companyId ?? null,
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

	async delete(id: string, actorId: string) {
		const access = await staffRole(this.db, actorId);
		if (!access.admin)
			throw new ForbiddenException(
				"Project deletion requires administrator access.",
			);
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
		const access = await staffRole(this.db, actingUserId);
		if (
			!access.admin &&
			!(await this.db.project.count({
				where: { id: input.projectId, ...assignedProjectWhere(actingUserId) },
			}))
		)
			throw new ForbiddenException("This project is not assigned to you.");
		await this.assertStaffAssignee(input.assigneeId);
		await this.assertTaskLinks(
			input.projectId,
			input.phaseId,
			input.parentTaskId,
		);
		const task = await this.db.projectTask.create({
			data: {
				projectId: input.projectId,
				title: input.title.trim(),
				description: blankToNull(input.description ?? ""),
				assigneeId: input.assigneeId || null,
				status: input.status,
				priority: input.priority,
				dueDate: date(input.dueDate),
				startDate: date(input.startDate),
				phaseId: input.phaseId || null,
				parentTaskId: input.parentTaskId || null,
				estimatedMinutes: input.estimatedMinutes,
				progress: input.progress,
				clientVisible: input.clientVisible,
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
				project: { select: { id: true, name: true, companyId: true } },
			},
		});
		await this.queueProjectWork({
			projectId: task.projectId,
			projectName: task.project.name,
			reason: `Task ${task.title} created by staff user ${actingUserId}.`,
			companyId: task.project.companyId,
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
		const access = await staffRole(this.db, actingUserId);
		if (
			!access.admin &&
			!(await this.db.projectTask.count({
				where: {
					id: input.id,
					project: assignedProjectWhere(actingUserId),
				},
			}))
		)
			throw new ForbiddenException(
				"This task is not assigned to your project.",
			);
		await this.assertStaffAssignee(input.assigneeId);
		const existingTask = await this.db.projectTask.findUnique({
			where: { id: input.id },
			select: { projectId: true },
		});
		if (!existingTask)
			throw new NotFoundException(`No task with id ${input.id}.`);
		await this.assertTaskLinks(
			existingTask.projectId,
			input.phaseId,
			input.parentTaskId,
			input.id,
		);
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
				...(input.startDate !== undefined
					? { startDate: date(input.startDate) }
					: {}),
				...(input.phaseId !== undefined
					? { phaseId: input.phaseId || null }
					: {}),
				...(input.parentTaskId !== undefined
					? { parentTaskId: input.parentTaskId || null }
					: {}),
				...(input.estimatedMinutes !== undefined
					? { estimatedMinutes: input.estimatedMinutes }
					: {}),
				...(input.progress !== undefined ? { progress: input.progress } : {}),
				...(input.clientVisible !== undefined
					? { clientVisible: input.clientVisible }
					: {}),
				...(input.status !== undefined
					? {
							status: input.status,
							progress:
								input.status === ProjectTaskStatus.DONE ? 100 : input.progress,
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
				project: { select: { id: true, name: true, companyId: true } },
			},
		});
		await this.queueProjectWork({
			projectId: task.projectId,
			projectName: task.project?.name ?? "project",
			reason: `Task ${task.title} updated by staff user ${actingUserId}.`,
			companyId: task.project?.companyId ?? null,
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

	async deleteTask(id: string, actorId: string) {
		const access = await staffRole(this.db, actorId);
		if (!access.admin)
			throw new ForbiddenException(
				"Task deletion requires administrator access.",
			);
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

	async createPhase(input: ProjectPhaseCreateInput, actorId: string) {
		await this.assertProjectAccess(input.projectId, actorId);
		return this.db.projectPhase.create({
			data: {
				projectId: input.projectId,
				name: input.name.trim(),
				color: input.color,
				startDate: date(input.startDate),
				dueDate: date(input.dueDate),
				clientVisible: input.clientVisible,
				position: await this.db.projectPhase.count({
					where: { projectId: input.projectId },
				}),
			},
			select: { id: true, projectId: true, name: true },
		});
	}

	async updatePhase(input: ProjectPhaseUpdateInput, actorId: string) {
		const phase = await this.db.projectPhase.findUnique({
			where: { id: input.id },
			select: { projectId: true },
		});
		if (!phase) throw new NotFoundException(`No phase with id ${input.id}.`);
		await this.assertProjectAccess(phase.projectId, actorId);
		return this.db.projectPhase.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined ? { name: input.name.trim() } : {}),
				...(input.color !== undefined ? { color: input.color } : {}),
				...(input.startDate !== undefined
					? { startDate: date(input.startDate) }
					: {}),
				...(input.dueDate !== undefined
					? { dueDate: date(input.dueDate) }
					: {}),
				...(input.clientVisible !== undefined
					? { clientVisible: input.clientVisible }
					: {}),
			},
			select: { id: true, projectId: true, name: true },
		});
	}

	async deletePhase(id: string, actorId: string) {
		const phase = await this.db.projectPhase.findUnique({
			where: { id },
			select: { projectId: true, name: true },
		});
		if (!phase) throw new NotFoundException(`No phase with id ${id}.`);
		await this.assertProjectAccess(phase.projectId, actorId);
		await this.db.projectPhase.delete({ where: { id } });
		return { id, projectId: phase.projectId, name: phase.name };
	}

	async addTaskComment(input: ProjectTaskCommentCreateInput, actorId: string) {
		await this.assertTaskAccess(input.taskId, actorId);
		const comment = await this.db.projectTaskComment.create({
			data: {
				taskId: input.taskId,
				authorId: actorId,
				body: input.body.trim(),
				internal: input.internal,
			},
			select: {
				id: true,
				taskId: true,
				body: true,
				internal: true,
				createdAt: true,
				task: {
					select: {
						project: {
							select: { id: true, name: true, companyId: true },
						},
					},
				},
				author: { select: USER_SELECT },
			},
		});
		await this.queueProjectWork({
			projectId: comment.task.project?.id ?? input.taskId,
			projectName: comment.task.project?.name ?? "project",
			reason: `Comment added by staff user ${actorId}: ${comment.body.slice(0, 80)}`,
			companyId: comment.task.project?.companyId ?? null,
		});
		return comment;
	}

	async addDependency(input: ProjectTaskDependencyInput, actorId: string) {
		if (input.taskId === input.blockedById)
			throw new ForbiddenException("A task cannot block itself.");
		const [task, blocker] = await Promise.all([
			this.assertTaskAccess(input.taskId, actorId),
			this.db.projectTask.findUnique({
				where: { id: input.blockedById },
				select: { projectId: true },
			}),
		]);
		if (!blocker || blocker.projectId !== task.projectId)
			throw new ForbiddenException(
				"Dependencies must belong to the same project.",
			);
		return this.db.projectTaskDependency.upsert({
			where: { taskId_blockedById: input },
			create: input,
			update: {},
			select: { taskId: true, blockedById: true },
		});
	}

	async removeDependency(input: ProjectTaskDependencyInput, actorId: string) {
		await this.assertTaskAccess(input.taskId, actorId);
		await this.db.projectTaskDependency.deleteMany({ where: input });
		return input;
	}

	async logTime(input: ProjectTimeEntryCreateInput, actorId: string) {
		await this.assertProjectAccess(input.projectId, actorId);
		if (input.taskId) {
			const task = await this.db.projectTask.findUnique({
				where: { id: input.taskId },
				select: { projectId: true },
			});
			if (!task || task.projectId !== input.projectId)
				throw new ForbiddenException(
					"That task does not belong to this project.",
				);
		}
		const startedAt = date(input.startedAt) ?? new Date();
		const entry = await this.db.timeEntry.create({
			data: {
				projectId: input.projectId,
				taskId: input.taskId || null,
				staffUserId: actorId,
				description: input.description.trim(),
				startedAt,
				endedAt: new Date(startedAt.getTime() + input.minutes * 60_000),
				minutes: input.minutes,
				billable: input.billable,
			},
			select: {
				id: true,
				projectId: true,
				taskId: true,
				minutes: true,
				project: { select: { name: true, companyId: true } },
			},
		});
		await this.queueProjectWork({
			projectId: input.projectId,
			projectName: entry.project?.name ?? "Project time entry",
			reason: "Time entry logged.",
			companyId: entry.project?.companyId ?? null,
		});
		return entry;
	}

	async syncWithProjectManager(
		input: ProjectManagerSyncInput,
		actorId: string,
	) {
		const access = await staffRole(this.db, actorId);
		if (!access.admin) {
			const assigned = await this.db.project.count({
				where: { id: input.projectId, ...assignedProjectWhere(actorId) },
			});
			if (!assigned)
				throw new ForbiddenException(
					"Only assigned staff may sync this project with the manager platform.",
				);
		}

		if (!PROJECT_MANAGER_BRIDGE_URL) {
			return {
				ok: false,
				projectId: input.projectId,
				direction: input.direction,
				reason: "Project manager bridge URL is not configured.",
			};
		}

		const snapshot = await this.buildProjectManagerSnapshot(
			input.projectId,
			actorId,
		);
		const request = {
			direction: input.direction,
			project: snapshot,
			meta: { actorId },
		};

		const headers = {
			"content-type": "application/json",
			...(PROJECT_MANAGER_BRIDGE_TOKEN
				? { Authorization: `Bearer ${PROJECT_MANAGER_BRIDGE_TOKEN}` }
				: {}),
		};

		try {
			const response = await fetch(
				`${PROJECT_MANAGER_BRIDGE_URL}/crm/projects/sync`,
				{
					method: "POST",
					headers,
					body: JSON.stringify(request),
					signal: AbortSignal.timeout(PROJECT_MANAGER_BRIDGE_TIMEOUT_MS),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Project manager bridge returned ${response.status} ${response.statusText}`,
				);
			}

			let bridgeResponse: unknown = null;
			try {
				bridgeResponse = await response.json();
			} catch {
				bridgeResponse = null;
			}

			await this.queueProjectWork({
				projectId: snapshot.id,
				projectName: snapshot.name,
				reason: `Project synced with manager bridge (${input.direction}).`,
				companyId: snapshot.companyId,
			});

			return {
				ok: true,
				projectId: input.projectId,
				direction: input.direction,
				bridgeResponse,
				reason: "Sync request sent.",
			};
		} catch (error) {
			this.logger.debug({
				message: "Project manager sync failed",
				projectId: input.projectId,
				reason: error instanceof Error ? error.message : String(error),
			});

			return {
				ok: false,
				projectId: input.projectId,
				direction: input.direction,
				reason:
					"Project manager bridge is unavailable right now. Try again in a moment.",
			};
		}
	}

	private async buildProjectManagerSnapshot(
		projectId: string,
		actorId: string,
	) {
		const access = await staffRole(this.db, actorId);
		const project = await this.db.project.findFirst({
			where: {
				id: projectId,
				...(access.admin ? {} : assignedProjectWhere(actorId)),
			},
			select: {
				id: true,
				name: true,
				description: true,
				status: true,
				startDate: true,
				dueDate: true,
				budget: true,
				currency: true,
				company: { select: { id: true, name: true } },
				owner: { select: USER_SELECT },
				members: {
					orderBy: { createdAt: "asc" },
					select: { role: true, user: { select: USER_SELECT } },
				},
				timeEntries: {
					orderBy: { startedAt: "desc" },
					take: 250,
					select: {
						id: true,
						taskId: true,
						description: true,
						minutes: true,
						billable: true,
						approved: true,
						startedAt: true,
						staffUser: { select: USER_SELECT },
					},
				},
				resourceUsage: {
					orderBy: { occurredAt: "desc" },
					take: 250,
					select: {
						id: true,
						taskId: true,
						agentId: true,
						label: true,
						processingMs: true,
						inputTokens: true,
						outputTokens: true,
						estimatedCost: true,
						occurredAt: true,
						metadata: true,
					},
				},
				meetingSummaries: {
					orderBy: { meetingAt: "desc" },
					take: 100,
					select: {
						id: true,
						title: true,
						meetingAt: true,
						durationMinutes: true,
						participantEmails: true,
						summary: true,
						actionItems: true,
						keywords: true,
						transcriptUrl: true,
						visibility: true,
					},
				},
				serviceRequests: {
					orderBy: { updatedAt: "desc" },
					take: 100,
					select: {
						id: true,
						reference: true,
						title: true,
						description: true,
						category: true,
						priority: true,
						status: true,
						resolution: true,
						createdAt: true,
						updatedAt: true,
					},
				},
				businessDocuments: {
					orderBy: { updatedAt: "desc" },
					select: {
						id: true,
						kind: true,
						title: true,
						label: true,
						description: true,
						fileName: true,
						mediaType: true,
						size: true,
						source: true,
						updatedAt: true,
					},
				},
				invoices: {
					orderBy: { issueDate: "desc" },
					select: {
						id: true,
						number: true,
						status: true,
						issueDate: true,
						dueDate: true,
						currency: true,
						total: true,
						amountPaid: true,
					},
				},
				phases: {
					orderBy: { position: "asc" },
					select: {
						id: true,
						name: true,
						color: true,
						position: true,
						startDate: true,
						dueDate: true,
					},
				},
				milestones: {
					orderBy: { position: "asc" },
					select: {
						id: true,
						title: true,
						completedAt: true,
						dueDate: true,
					},
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
						createdAt: true,
						dueDate: true,
						startDate: true,
						completedAt: true,
						progress: true,
						estimatedMinutes: true,
						clientVisible: true,
						parentTaskId: true,
						phase: { select: { id: true, name: true, color: true } },
						assignee: { select: USER_SELECT },
						blockedBy: {
							select: {
								blockedBy: {
									select: { id: true, title: true, status: true },
								},
							},
						},
						comments: {
							orderBy: { createdAt: "asc" },
							select: {
								id: true,
								body: true,
								internal: true,
								createdAt: true,
								author: { select: USER_SELECT },
							},
						},
					},
				},
			},
		});

		if (!project)
			throw new NotFoundException(`No project with id ${projectId}.`);

		return {
			id: project.id,
			name: project.name,
			description: project.description,
			status: project.status,
			startDate: project.startDate?.toISOString() ?? null,
			dueDate: project.dueDate?.toISOString() ?? null,
			currency: project.currency,
			budget: access.admin && project.budget ? project.budget.toString() : null,
			companyId: project.company?.id ?? null,
			companyName: project.company?.name ?? null,
			owner: project.owner,
			members: project.members.map((member) => ({
				user: member.user,
				role: member.role ?? null,
			})),
			phases: project.phases.map((phase) => ({
				...phase,
				startDate: phase.startDate?.toISOString() ?? null,
				dueDate: phase.dueDate?.toISOString() ?? null,
			})),
			milestones: project.milestones.map((milestone) => ({
				...milestone,
				dueDate: milestone.dueDate?.toISOString() ?? null,
				completedAt: milestone.completedAt?.toISOString() ?? null,
			})),
			tasks: project.tasks.map((task) => ({
				...task,
				createdAt: task.createdAt.toISOString(),
				dueDate: task.dueDate?.toISOString() ?? null,
				startDate: task.startDate?.toISOString() ?? null,
				completedAt: task.completedAt?.toISOString() ?? null,
				comments: task.comments.map((comment) => ({
					...comment,
					createdAt: comment.createdAt.toISOString(),
				})),
			})),
			timeEntries: project.timeEntries.map((entry) => ({
				...entry,
				startedAt: entry.startedAt.toISOString(),
			})),
			resourceUsage: project.resourceUsage.map((entry) => ({
				...entry,
				estimatedCost: access.admin ? entry.estimatedCost.toString() : null,
				occurredAt: entry.occurredAt.toISOString(),
			})),
			meetingSummaries: project.meetingSummaries.map((meeting) => ({
				...meeting,
				meetingAt: meeting.meetingAt.toISOString(),
			})),
			serviceRequests: project.serviceRequests.map((request) => ({
				...request,
				createdAt: request.createdAt.toISOString(),
				updatedAt: request.updatedAt.toISOString(),
			})),
			documents: project.businessDocuments.map((document) => ({
				...document,
				updatedAt: document.updatedAt.toISOString(),
			})),
			invoices: access.admin
				? project.invoices.map((invoice) => ({
						...invoice,
						issueDate: invoice.issueDate.toISOString(),
						dueDate: invoice.dueDate.toISOString(),
						total: invoice.total.toString(),
						amountPaid: invoice.amountPaid.toString(),
					}))
				: [],
		};
	}

	private async queueProjectWork(input: {
		projectId: string;
		projectName: string;
		reason: string;
		companyId: string | null;
	}) {
		if (!this.agent) return;

		await this.agent
			.projectWork({
				projectId: input.projectId,
				companyId: input.companyId,
				reason: `${input.projectName}: ${input.reason}`,
			})
			.catch((error) => {
				this.logger.debug({
					message: "Could not queue project work for agent visibility",
					projectId: input.projectId,
					reason: error instanceof Error ? error.message : String(error),
				});
			});
	}

	private async assertProjectAccess(projectId: string, actorId: string) {
		const access = await staffRole(this.db, actorId);
		const project = await this.db.project.findFirst({
			where: {
				id: projectId,
				...(access.admin ? {} : assignedProjectWhere(actorId)),
			},
			select: { id: true },
		});
		if (!project)
			throw new ForbiddenException("This project is not assigned to you.");
		return project;
	}

	private async assertTaskAccess(taskId: string, actorId: string) {
		const access = await staffRole(this.db, actorId);
		const task = await this.db.projectTask.findFirst({
			where: {
				id: taskId,
				...(access.admin ? {} : { project: assignedProjectWhere(actorId) }),
			},
			select: { id: true, projectId: true },
		});
		if (!task)
			throw new ForbiddenException(
				"This task is not assigned to your project.",
			);
		return task;
	}

	private async assertStaffAssignee(assigneeId: string | null | undefined) {
		if (!assigneeId) return;
		try {
			await staffRole(this.db, assigneeId);
		} catch {
			throw new ForbiddenException(
				"Project tasks can only be assigned to active staff members, not client portal users.",
			);
		}
	}

	private async assertTaskLinks(
		projectId: string,
		phaseId?: string | null,
		parentTaskId?: string | null,
		taskId?: string,
	) {
		if (taskId && parentTaskId === taskId)
			throw new ForbiddenException("A task cannot be its own parent.");
		const [phase, parent] = await Promise.all([
			phaseId
				? this.db.projectPhase.findUnique({
						where: { id: phaseId },
						select: { projectId: true },
					})
				: null,
			parentTaskId
				? this.db.projectTask.findUnique({
						where: { id: parentTaskId },
						select: { projectId: true },
					})
				: null,
		]);
		if (phaseId && phase?.projectId !== projectId)
			throw new ForbiddenException("That phase belongs to another project.");
		if (parentTaskId && parent?.projectId !== projectId)
			throw new ForbiddenException(
				"That parent task belongs to another project.",
			);
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
