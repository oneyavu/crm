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
});
export type ProjectTaskCreateInput = z.infer<typeof projectTaskCreateInput>;

export const projectTaskUpdateInput = projectTaskCreateInput
	.omit({ projectId: true })
	.partial()
	.extend({ id: z.string().min(1) });
export type ProjectTaskUpdateInput = z.infer<typeof projectTaskUpdateInput>;
