import { ProjectStatus, ProjectTaskPriority, ProjectTaskStatus } from "@crm/db";
import { z } from "zod";
import { currencyCode } from "../currency/currency.contracts";
import { listInput } from "../trpc/list-input";

const projectStatus = z.enum(
	Object.values(ProjectStatus) as [ProjectStatus, ...ProjectStatus[]],
);
const taskStatus = z.enum(
	Object.values(ProjectTaskStatus) as [
		ProjectTaskStatus,
		...ProjectTaskStatus[],
	],
);
const taskPriority = z.enum(
	Object.values(ProjectTaskPriority) as [
		ProjectTaskPriority,
		...ProjectTaskPriority[],
	],
);

export const projectListInput = listInput.extend({
	status: z.string().default("all"),
	owner: z.string().default("all"),
});
export type ProjectListInput = z.infer<typeof projectListInput>;

export const projectIdInput = z.object({ id: z.string().min(1) });
export const projectTaskIdInput = z.object({ id: z.string().min(1) });

export const projectCreateInput = z.object({
	name: z.string().trim().min(1, "A project needs a name."),
	description: z.string().trim().nullable().optional(),
	companyId: z.string().nullable().optional(),
	ownerId: z.string().min(1, "A project needs an owner."),
	status: projectStatus.optional(),
	startDate: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	budgetCents: z.number().int().min(0).nullable().optional(),
	currency: currencyCode.optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateInput>;

export const projectUpdateInput = projectCreateInput.partial().extend({
	id: z.string().min(1),
});
export type ProjectUpdateInput = z.infer<typeof projectUpdateInput>;

export const projectTaskCreateInput = z.object({
	projectId: z.string().min(1),
	title: z.string().trim().min(1, "A task needs a title."),
	description: z.string().trim().nullable().optional(),
	assigneeId: z.string().nullable().optional(),
	status: taskStatus.optional(),
	priority: taskPriority.optional(),
	dueDate: z.string().nullable().optional(),
	startDate: z.string().nullable().optional(),
	phaseId: z.string().nullable().optional(),
	parentTaskId: z.string().nullable().optional(),
	estimatedMinutes: z.number().int().min(0).max(525_600).optional(),
	progress: z.number().int().min(0).max(100).optional(),
	clientVisible: z.boolean().optional(),
});
export type ProjectTaskCreateInput = z.infer<typeof projectTaskCreateInput>;

export const projectTaskUpdateInput = projectTaskCreateInput
	.omit({ projectId: true })
	.partial()
	.extend({ id: z.string().min(1) });
export type ProjectTaskUpdateInput = z.infer<typeof projectTaskUpdateInput>;

export const projectPhaseCreateInput = z.object({
	projectId: z.string().min(1),
	name: z.string().trim().min(1).max(100),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	startDate: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	clientVisible: z.boolean().optional(),
});
export const projectPhaseUpdateInput = projectPhaseCreateInput
	.omit({ projectId: true })
	.partial()
	.extend({ id: z.string().min(1) });
export type ProjectPhaseCreateInput = z.infer<typeof projectPhaseCreateInput>;
export type ProjectPhaseUpdateInput = z.infer<typeof projectPhaseUpdateInput>;

export const projectTaskCommentCreateInput = z.object({
	taskId: z.string().min(1),
	body: z.string().trim().min(1).max(10_000),
	internal: z.boolean().default(true),
});
export type ProjectTaskCommentCreateInput = z.infer<
	typeof projectTaskCommentCreateInput
>;

export const projectTaskDependencyInput = z.object({
	taskId: z.string().min(1),
	blockedById: z.string().min(1),
});
export type ProjectTaskDependencyInput = z.infer<
	typeof projectTaskDependencyInput
>;

export const projectTimeEntryCreateInput = z.object({
	projectId: z.string().min(1),
	taskId: z.string().nullable().optional(),
	description: z.string().trim().min(1).max(500),
	minutes: z.number().int().min(1).max(1_440),
	billable: z.boolean().default(false),
	startedAt: z.string().optional(),
});
export type ProjectTimeEntryCreateInput = z.infer<
	typeof projectTimeEntryCreateInput
>;
