import { db } from "@crm/db";

const USER_SELECT = { id: true, name: true, email: true } as const;

export async function listProjectsForAgent(input: {
	query?: string;
	status?: string;
	limit: number;
}) {
	const query = input.query?.trim();
	const rows = await db.project.findMany({
		where: {
			...(query
				? {
						OR: [
							{ name: { contains: query, mode: "insensitive" as const } },
							{
								company: {
									name: { contains: query, mode: "insensitive" as const },
								},
							},
						],
					}
				: {}),
			...(input.status && input.status !== "all"
				? { status: input.status as never }
				: {}),
		},
		orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
		take: input.limit,
		select: {
			id: true,
			name: true,
			description: true,
			status: true,
			startDate: true,
			dueDate: true,
			updatedAt: true,
			company: { select: { id: true, name: true } },
			owner: { select: USER_SELECT },
			_count: {
				select: {
					tasks: true,
					milestones: true,
					timeEntries: true,
					serviceRequests: true,
				},
			},
			tasks: {
				where: { status: "DONE" },
				select: { id: true },
			},
		},
	});

	return {
		count: rows.length,
		projects: rows.map((row) => ({
			id: row.id,
			name: row.name,
			description: row.description,
			status: row.status,
			startDate: iso(row.startDate),
			dueDate: iso(row.dueDate),
			updatedAt: row.updatedAt.toISOString(),
			company: row.company,
			projectManager: row.owner,
			progress:
				row._count.tasks === 0
					? 0
					: Math.round((row.tasks.length / row._count.tasks) * 100),
			counts: row._count,
		})),
	};
}

export async function readProjectForAgent(projectId: string) {
	const project = await db.project.findUnique({
		where: { id: projectId },
		select: {
			id: true,
			name: true,
			description: true,
			status: true,
			startDate: true,
			dueDate: true,
			currency: true,
			createdAt: true,
			updatedAt: true,
			company: { select: { id: true, name: true, domain: true } },
			owner: { select: USER_SELECT },
			members: {
				orderBy: { createdAt: "asc" },
				select: { role: true, user: { select: USER_SELECT } },
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
					description: true,
					dueDate: true,
					completedAt: true,
					clientVisible: true,
				},
			},
			tasks: {
				orderBy: [{ status: "asc" }, { position: "asc" }],
				select: {
					id: true,
					title: true,
					description: true,
					status: true,
					priority: true,
					progress: true,
					estimatedMinutes: true,
					startDate: true,
					dueDate: true,
					completedAt: true,
					clientVisible: true,
					parentTaskId: true,
					phase: { select: { id: true, name: true } },
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
		},
	});

	if (!project) return null;

	const totalMinutes = project.timeEntries.reduce(
		(sum, entry) => sum + entry.minutes,
		0,
	);
	const completedTasks = project.tasks.filter(
		(task) => task.status === "DONE",
	).length;
	const usage = project.resourceUsage.reduce(
		(acc, row) => ({
			processingMs: acc.processingMs + row.processingMs,
			inputTokens: acc.inputTokens + row.inputTokens,
			outputTokens: acc.outputTokens + row.outputTokens,
			estimatedCost: acc.estimatedCost + Number(row.estimatedCost),
		}),
		{ processingMs: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
	);

	return {
		...project,
		startDate: iso(project.startDate),
		dueDate: iso(project.dueDate),
		createdAt: project.createdAt.toISOString(),
		updatedAt: project.updatedAt.toISOString(),
		phases: project.phases.map((row) => ({
			...row,
			startDate: iso(row.startDate),
			dueDate: iso(row.dueDate),
		})),
		milestones: project.milestones.map((row) => ({
			...row,
			dueDate: iso(row.dueDate),
			completedAt: iso(row.completedAt),
		})),
		tasks: project.tasks.map((row) => ({
			...row,
			startDate: iso(row.startDate),
			dueDate: iso(row.dueDate),
			completedAt: iso(row.completedAt),
			comments: row.comments.map((comment) => ({
				...comment,
				createdAt: comment.createdAt.toISOString(),
			})),
		})),
		timeEntries: project.timeEntries.map((row) => ({
			...row,
			startedAt: row.startedAt.toISOString(),
		})),
		resourceUsage: project.resourceUsage.map((row) => ({
			...row,
			estimatedCost: Number(row.estimatedCost),
			occurredAt: row.occurredAt.toISOString(),
		})),
		meetingSummaries: project.meetingSummaries.map((row) => ({
			...row,
			meetingAt: row.meetingAt.toISOString(),
		})),
		serviceRequests: project.serviceRequests.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		})),
		businessDocuments: project.businessDocuments.map((row) => ({
			...row,
			updatedAt: row.updatedAt.toISOString(),
		})),
		invoices: project.invoices.map((row) => ({
			...row,
			issueDate: row.issueDate.toISOString(),
			dueDate: row.dueDate.toISOString(),
			total: Number(row.total),
			amountPaid: Number(row.amountPaid),
		})),
		summary: {
			progress:
				project.tasks.length === 0
					? 0
					: Math.round((completedTasks / project.tasks.length) * 100),
			completedTasks,
			totalTasks: project.tasks.length,
			totalMinutes,
			aiUsage: usage,
			openServiceRequests: project.serviceRequests.filter(
				(row) => row.status !== "RESOLVED" && row.status !== "CLOSED",
			).length,
		},
	};
}

function iso(value: Date | null): string | null {
	return value?.toISOString() ?? null;
}
