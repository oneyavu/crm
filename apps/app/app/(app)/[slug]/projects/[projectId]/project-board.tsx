"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const PROJECT_MANAGER_PLATFORM_URL =
	process.env.NEXT_PUBLIC_PROJECT_MANAGER_PLATFORM_URL ?? "";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
type ProjectData = RouterOutputs["projects"]["byId"];
type ProjectTask = ProjectData["tasks"][number];

export function ProjectBoard({ projectId }: { projectId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const router = useRouter();
	const [taskTitle, setTaskTitle] = useState("");
	const [taskPhaseId, setTaskPhaseId] = useState("");
	const [phaseName, setPhaseName] = useState("");
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [comment, setComment] = useState("");
	const [timeDescription, setTimeDescription] = useState("");
	const [timeMinutes, setTimeMinutes] = useState("30");
	const [timeTaskId, setTimeTaskId] = useState("");

	const project = useQuery({
		...trpc.projects.byId.queryOptions({ id: projectId }),
		refetchInterval: 5_000,
		refetchIntervalInBackground: true,
	});
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.projects.byId.queryKey({ id: projectId }),
		});
	const createTask = useMutation(
		trpc.projects.createTask.mutationOptions({
			onSuccess: async () => {
				setTaskTitle("");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const updateTask = useMutation(
		trpc.projects.updateTask.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const deleteTask = useMutation(
		trpc.projects.deleteTask.mutationOptions({
			onSuccess: async (task) => {
				setSelectedTaskId(null);
				await refresh();
				toast.success(`${task.title} deleted.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const createPhase = useMutation(
		trpc.projects.createPhase.mutationOptions({
			onSuccess: async () => {
				setPhaseName("");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const addComment = useMutation(
		trpc.projects.addTaskComment.mutationOptions({
			onSuccess: async () => {
				setComment("");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const addDependency = useMutation(
		trpc.projects.addDependency.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const logTime = useMutation(
		trpc.projects.logTime.mutationOptions({
			onSuccess: async () => {
				setTimeDescription("");
				await refresh();
				toast.success("Time recorded.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const deleteProject = useMutation(
		trpc.projects.delete.mutationOptions({
			onSuccess: async (deleted) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.projects.list.queryKey(),
				});
				toast.success(`${deleted.name} deleted.`);
				router.push(workspaceUrl("/projects"));
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const syncWithProjectManager = useMutation(
		trpc.projects.syncWithProjectManager.mutationOptions({
			onSuccess: (result) => {
				if (result.ok) {
					toast.success("Project synced with manager platform.");
				} else {
					toast.warning(result.reason);
				}
				setSyncingDirection(null);
				setLastSyncMessage(result.reason);
				refresh();
			},
			onError: (error) => {
				setSyncingDirection(null);
				setLastSyncMessage("Sync failed: " + error.message);
				toast.error(error.message);
			},
		}),
	);
	const [lastSyncMessage, setLastSyncMessage] = useState<
		string | null
	>(null);
	const [syncingDirection, setSyncingDirection] = useState<
		"push" | "pull" | "full" | null
	>(null);

	const data = project.data;
	const selectedTask =
		data?.tasks.find((task) => task.id === selectedTaskId) ?? null;
	const completed =
		data?.tasks.filter((task) => task.status === "DONE").length ?? 0;
	const totalMinutes =
		data?.timeEntries.reduce((sum, entry) => sum + entry.minutes, 0) ?? 0;
	const estimatedMinutes =
		data?.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) ?? 0;

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{data?.name ?? "Project workspace"}</PageShellTitle>
					<PageShellDescription>
						{data?.description ??
							`${data?.company?.name ?? "Internal"} delivery workspace`}
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Link
						href={workspaceUrl("/projects")}
						className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
					>
						<ArrowLeft /> Projects
					</Link>
					<div className="flex items-center gap-2">
						<span className="size-2 animate-pulse rounded-full bg-[#6cd32c]" />
						<span className="text-muted-foreground text-xs">
							Live workspace
						</span>
						{data?.owner?.name ? (
							<span className="text-muted-foreground text-xs">
								· Project manager: {data.owner.name}
							</span>
						) : null}
						<Button
							variant="outline"
							onClick={() =>
								confirm("Permanently delete this project and its tasks?") &&
								deleteProject.mutate({ id: projectId })
							}
						>
							<TrashCan data-icon="inline-start" /> Delete
						</Button>
					</div>
				</div>

				<section className="overflow-hidden rounded-2xl border border-[#6cd32c]/20 bg-gradient-to-br from-[#0d160e] via-card to-card p-5 shadow-[0_20px_80px_-45px_rgba(108,211,44,.55)]">
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
						<Metric
							label="Progress"
							value={`${data?.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0}%`}
							detail={`${completed} of ${data?.tasks.length ?? 0} tasks complete`}
						/>
						<Metric
							label="Delivery window"
							value={dateLabel(data?.dueDate)}
							detail={data?.status ? label(data.status) : "Loading"}
						/>
						<Metric
							label="Planned effort"
							value={duration(estimatedMinutes)}
							detail={`${duration(totalMinutes)} recorded`}
						/>
						<Metric
							label="Team"
							value={String((data?.members.length ?? 0) + 1)}
							detail={data?.company?.name ?? "Internal project"}
						/>
					</div>
				</section>

				<form
					className="grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-[1fr_190px_auto]"
					onSubmit={(event) => {
						event.preventDefault();
						createTask.mutate({
							projectId,
							title: taskTitle,
							phaseId: taskPhaseId || null,
						});
					}}
				>
					<Input
						value={taskTitle}
						onChange={(event) => setTaskTitle(event.target.value)}
						placeholder="Add the next task"
						aria-label="Task title"
						required
					/>
					<select
						className="h-8 rounded-md border bg-background px-2 text-xs"
						value={taskPhaseId}
						onChange={(event) => setTaskPhaseId(event.target.value)}
						aria-label="Task phase"
					>
						<option value="">No phase</option>
						{data?.phases.map((phase) => (
							<option key={phase.id} value={phase.id}>
								{phase.name}
							</option>
						))}
					</select>
					<Button
						type="submit"
						disabled={!taskTitle.trim() || createTask.isPending}
					>
						Add task
					</Button>
				</form>

				<Tabs defaultValue="board">
					<TabsList className="h-auto flex-wrap justify-start" variant="line">
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="board">Board</TabsTrigger>
						<TabsTrigger value="list">List</TabsTrigger>
						<TabsTrigger value="timeline">Timeline</TabsTrigger>
						<TabsTrigger value="workload">Workload</TabsTrigger>
						<TabsTrigger value="time">Time</TabsTrigger>
						<TabsTrigger value="platform">Project manager</TabsTrigger>
					</TabsList>
					<TabsContent value="overview">
						<Overview
							data={data}
							phaseName={phaseName}
							setPhaseName={setPhaseName}
							onCreatePhase={() =>
								createPhase.mutate({ projectId, name: phaseName })
							}
						/>
					</TabsContent>
					<TabsContent value="board">
						<Board
							data={data}
							onSelect={setSelectedTaskId}
							onStatus={(id, status) => updateTask.mutate({ id, status })}
						/>
					</TabsContent>
					<TabsContent value="list">
						<TaskList
							data={data}
							onSelect={setSelectedTaskId}
							onStatus={(id, status) => updateTask.mutate({ id, status })}
						/>
					</TabsContent>
					<TabsContent value="timeline">
						<Timeline data={data} onSelect={setSelectedTaskId} />
					</TabsContent>
					<TabsContent value="workload">
						<Workload data={data} />
					</TabsContent>
					<TabsContent value="time">
						<TimePanel
							data={data}
							description={timeDescription}
							setDescription={setTimeDescription}
							minutes={timeMinutes}
							setMinutes={setTimeMinutes}
							taskId={timeTaskId}
							setTaskId={setTimeTaskId}
							onSubmit={() =>
								logTime.mutate({
									projectId,
									taskId: timeTaskId || null,
									description: timeDescription,
									minutes: Number(timeMinutes),
									billable: false,
								})
							}
						/>
					</TabsContent>
					<TabsContent value="platform">
						<ProjectManagerPanel
							projectId={projectId}
							projectName={data?.name ?? "Project"}
							projectCompany={data?.company?.name ?? "Internal project"}
							projectManager={data?.owner?.name ?? "Unassigned"}
							platformUrl={PROJECT_MANAGER_PLATFORM_URL}
							isSyncing={syncWithProjectManager.isPending}
							syncDirection={syncingDirection}
							onSync={(direction) => {
								setSyncingDirection(direction);
								setLastSyncMessage(null);
								syncWithProjectManager.mutate({
									projectId,
									direction,
								});
							}}
							lastSyncMessage={lastSyncMessage}
							onSyncSettled={(message) => setLastSyncMessage(message)}
						/>
					</TabsContent>
				</Tabs>

				{selectedTask ? (
					<TaskInspector
						task={selectedTask}
						tasks={data?.tasks ?? []}
						phases={data?.phases ?? []}
						comment={comment}
						setComment={setComment}
						onClose={() => setSelectedTaskId(null)}
						onUpdate={(values) =>
							updateTask.mutate({ id: selectedTask.id, ...values })
						}
						onComment={() =>
							addComment.mutate({
								taskId: selectedTask.id,
								body: comment,
								internal: true,
							})
						}
						onDependency={(blockedById) =>
							addDependency.mutate({ taskId: selectedTask.id, blockedById })
						}
						onDelete={() =>
							confirm(`Permanently delete ${selectedTask.title}?`) &&
							deleteTask.mutate({ id: selectedTask.id })
						}
					/>
				) : null}
			</PageShellContent>
		</PageShell>
	);
}

function Metric({
	label: title,
	value,
	detail,
}: {
	label: string;
	value: string;
	detail: string;
}) {
	return (
		<div className="rounded-xl border border-white/8 bg-black/25 p-4">
			<p className="text-[#6cd32c] text-xs">{title}</p>
			<p className="mt-2 font-semibold text-2xl tracking-tight text-white">
				{value}
			</p>
			<p className="mt-1 text-white/55 text-xs">{detail}</p>
		</div>
	);
}

function Overview({
	data,
	phaseName,
	setPhaseName,
	onCreatePhase,
}: {
	data?: ProjectData;
	phaseName: string;
	setPhaseName: (value: string) => void;
	onCreatePhase: () => void;
}) {
	return (
		<div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
			<section className="rounded-xl border bg-card p-4">
				<h2 className="font-semibold">Delivery phases</h2>
				<div className="mt-4 grid gap-3">
					{data?.phases.map((phase) => {
						const tasks = data.tasks.filter(
							(task) => task.phase?.id === phase.id,
						);
						const done = tasks.filter((task) => task.status === "DONE").length;
						return (
							<div key={phase.id} className="rounded-lg border p-3">
								<div className="flex justify-between gap-3">
									<span className="flex items-center gap-2 font-medium">
										<span
											className="size-2 rounded-full"
											style={{ background: phase.color }}
										/>
										{phase.name}
									</span>
									<span className="text-muted-foreground">
										{done}/{tasks.length}
									</span>
								</div>
								<Progress
									value={tasks.length ? (done / tasks.length) * 100 : 0}
								/>
							</div>
						);
					})}
					{data?.phases.length === 0 ? (
						<Empty text="Create phases to organize discovery, build, review and launch." />
					) : null}
				</div>
			</section>
			<section className="rounded-xl border bg-card p-4">
				<h2 className="font-semibold">Add phase</h2>
				<p className="mt-1 text-muted-foreground">
					A phase is shared by board, list and timeline views.
				</p>
				<form
					className="mt-4 flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						onCreatePhase();
					}}
				>
					<Input
						value={phaseName}
						onChange={(event) => setPhaseName(event.target.value)}
						placeholder="e.g. Discovery"
						required
					/>
					<Button type="submit" disabled={!phaseName.trim()}>
						Add
					</Button>
				</form>
				<h3 className="mt-6 font-medium">Milestones</h3>
				<div className="mt-2 grid gap-2">
					{data?.milestones.map((item) => (
						<div
							key={item.id}
							className="flex justify-between rounded-md border p-2"
						>
							<span>{item.title}</span>
							<span className="text-muted-foreground">
								{dateLabel(item.dueDate)}
							</span>
						</div>
					))}
					{data?.milestones.length === 0 ? (
						<p className="text-muted-foreground">No milestones recorded yet.</p>
					) : null}
				</div>
			</section>
		</div>
	);
}

function Board({
	data,
	onSelect,
	onStatus,
}: {
	data?: ProjectData;
	onSelect: (id: string) => void;
	onStatus: (id: string, status: (typeof STATUSES)[number]) => void;
}) {
	return (
		<div className="grid gap-3 xl:grid-cols-4">
			{STATUSES.map((status) => (
				<section
					key={status}
					className="min-h-72 rounded-xl border bg-muted/25 p-3"
				>
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-medium">{label(status)}</h2>
						<Badge variant="secondary">
							{data?.tasks.filter((task) => task.status === status).length ?? 0}
						</Badge>
					</div>
					<div className="grid gap-2">
						{data?.tasks
							.filter((task) => task.status === status)
							.map((task) => (
								<article
									key={task.id}
									className="rounded-lg border bg-card p-3 shadow-xs transition hover:border-[#6cd32c]/50"
								>
									<div className="flex items-start justify-between gap-2">
										<button
											type="button"
											className="text-left font-medium hover:text-[#6cd32c]"
											onClick={() => onSelect(task.id)}
										>
											{task.title}
										</button>
										<Badge variant="outline">{label(task.priority)}</Badge>
									</div>
									<p className="mt-2 text-muted-foreground">
										{task.phase?.name ?? "Unphased"} ·{" "}
										{task.assignee?.name ?? "Unassigned"}
									</p>
									<Progress value={task.progress} />
									<select
										className="mt-3 h-7 w-full rounded border bg-background px-2"
										value={task.status}
										onClick={(event) => event.stopPropagation()}
										onChange={(event) =>
											onStatus(
												task.id,
												event.target.value as (typeof STATUSES)[number],
											)
										}
									>
										{STATUSES.map((option) => (
											<option key={option} value={option}>
												{label(option)}
											</option>
										))}
									</select>
								</article>
							))}
					</div>
				</section>
			))}
		</div>
	);
}

function TaskList({
	data,
	onSelect,
	onStatus,
}: {
	data?: ProjectData;
	onSelect: (id: string) => void;
	onStatus: (id: string, status: (typeof STATUSES)[number]) => void;
}) {
	return (
		<div className="overflow-x-auto rounded-xl border">
			<table className="w-full min-w-[760px] text-left">
				<thead className="bg-muted/50 text-muted-foreground">
					<tr>
						<th className="p-3">Task</th>
						<th>Phase</th>
						<th>Assignee</th>
						<th>Dates</th>
						<th>Progress</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{data?.tasks.map((task) => (
						<tr key={task.id} className="border-t hover:bg-muted/25">
							<td className="p-3 font-medium">
								<button
									type="button"
									className="text-left hover:text-[#6cd32c]"
									onClick={() => onSelect(task.id)}
								>
									{task.parentTaskId ? "↳ " : ""}
									{task.title}
								</button>
							</td>
							<td>{task.phase?.name ?? "—"}</td>
							<td>{task.assignee?.name ?? "Unassigned"}</td>
							<td>
								{dateLabel(task.startDate)} – {dateLabel(task.dueDate)}
							</td>
							<td className="w-36">
								<Progress value={task.progress} />
							</td>
							<td>
								<select
									className="h-7 rounded border bg-background px-2"
									value={task.status}
									onChange={(event) =>
										onStatus(
											task.id,
											event.target.value as (typeof STATUSES)[number],
										)
									}
								>
									{STATUSES.map((option) => (
										<option key={option} value={option}>
											{label(option)}
										</option>
									))}
								</select>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function Timeline({
	data,
	onSelect,
}: {
	data?: ProjectData;
	onSelect: (id: string) => void;
}) {
	const tasks = useMemo(
		() =>
			[...(data?.tasks ?? [])].sort((a, b) =>
				String(a.startDate ?? a.dueDate ?? "9").localeCompare(
					String(b.startDate ?? b.dueDate ?? "9"),
				),
			),
		[data],
	);
	return (
		<div className="rounded-xl border bg-card p-4">
			<div className="mb-4 grid grid-cols-[minmax(180px,1fr)_2fr] text-muted-foreground">
				<span>Task</span>
				<span>Schedule</span>
			</div>
			<div className="grid gap-2">
				{tasks.map((task) => (
					<button
						key={task.id}
						type="button"
						className="grid grid-cols-[minmax(180px,1fr)_2fr] items-center gap-4 rounded-lg border p-3 text-left hover:border-[#6cd32c]/50"
						onClick={() => onSelect(task.id)}
					>
						<span>
							<strong className="block">{task.title}</strong>
							<small className="text-muted-foreground">
								{task.phase?.name ?? "Unphased"}
							</small>
						</span>
						<span>
							<span className="mb-1 flex justify-between text-muted-foreground">
								<small>{dateLabel(task.startDate)}</small>
								<small>{dateLabel(task.dueDate)}</small>
							</span>
							<Progress value={task.progress} />
						</span>
					</button>
				))}
				{tasks.length === 0 ? (
					<Empty text="Add tasks and dates to build the delivery timeline." />
				) : null}
			</div>
		</div>
	);
}

function Workload({ data }: { data?: ProjectData }) {
	const people = [
		{ id: data?.owner.id ?? "owner", name: data?.owner.name ?? "Owner" },
		...(data?.members ?? [])
			.filter((member) => member.user.id !== data?.owner.id)
			.map((member) => member.user),
	];
	return (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{people.map((person) => {
				const tasks =
					data?.tasks.filter((task) => task.assignee?.id === person.id) ?? [];
				const estimate = tasks.reduce(
					(sum, task) => sum + task.estimatedMinutes,
					0,
				);
				const logged =
					data?.timeEntries
						.filter((entry) => entry.staffUser?.id === person.id)
						.reduce((sum, entry) => sum + entry.minutes, 0) ?? 0;
				return (
					<article key={person.id} className="rounded-xl border bg-card p-4">
						<div className="flex items-center justify-between">
							<h2 className="font-semibold">{person.name}</h2>
							<Badge variant="secondary">{tasks.length} tasks</Badge>
						</div>
						<p className="mt-4 text-muted-foreground">
							{duration(logged)} recorded / {duration(estimate)} planned
						</p>
						<Progress
							value={estimate ? Math.min(100, (logged / estimate) * 100) : 0}
						/>
						<p className="mt-3 text-muted-foreground">
							{tasks.filter((task) => task.status === "BLOCKED").length} blocked
							· {tasks.filter((task) => task.status === "DONE").length} complete
						</p>
					</article>
				);
			})}
		</div>
	);
}

function TimePanel({
	data,
	description,
	setDescription,
	minutes,
	setMinutes,
	taskId,
	setTaskId,
	onSubmit,
}: {
	data?: ProjectData;
	description: string;
	setDescription: (v: string) => void;
	minutes: string;
	setMinutes: (v: string) => void;
	taskId: string;
	setTaskId: (v: string) => void;
	onSubmit: () => void;
}) {
	return (
		<div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
			<form
				className="rounded-xl border bg-card p-4"
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
				}}
			>
				<h2 className="font-semibold">Record work</h2>
				<div className="mt-4 grid gap-3">
					<Input
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="What was completed?"
						required
					/>
					<select
						className="h-8 rounded-md border bg-background px-2"
						value={taskId}
						onChange={(event) => setTaskId(event.target.value)}
					>
						<option value="">General project work</option>
						{data?.tasks.map((task) => (
							<option key={task.id} value={task.id}>
								{task.title}
							</option>
						))}
					</select>
					<Input
						type="number"
						min="1"
						max="1440"
						value={minutes}
						onChange={(event) => setMinutes(event.target.value)}
						aria-label="Minutes"
					/>
					<Button type="submit">Record time</Button>
				</div>
			</form>
			<section className="rounded-xl border bg-card p-4">
				<h2 className="font-semibold">Recent work log</h2>
				<div className="mt-4 grid gap-2">
					{data?.timeEntries.map((entry) => (
						<div
							key={entry.id}
							className="flex items-start justify-between gap-4 rounded-lg border p-3"
						>
							<span>
								<strong className="block">{entry.description}</strong>
								<small className="text-muted-foreground">
									{entry.staffUser?.name ?? "Former staff"} ·{" "}
									{dateLabel(entry.startedAt)}
								</small>
							</span>
							<Badge variant="outline">{duration(entry.minutes)}</Badge>
						</div>
					))}
					{data?.timeEntries.length === 0 ? (
						<Empty text="No time has been recorded." />
					) : null}
				</div>
			</section>
		</div>
	);
}

function TaskInspector({
	task,
	tasks,
	phases,
	comment,
	setComment,
	onClose,
	onUpdate,
	onComment,
	onDependency,
	onDelete,
}: {
	task: ProjectTask;
	tasks: ProjectTask[];
	phases: ProjectData["phases"];
	comment: string;
	setComment: (v: string) => void;
	onClose: () => void;
	onUpdate: (
		values: Partial<{
			title: string;
			description: string | null;
			phaseId: string | null;
			estimatedMinutes: number;
			startDate: string | null;
			dueDate: string | null;
			progress: number;
			clientVisible: boolean;
		}>,
	) => void;
	onComment: () => void;
	onDependency: (id: string) => void;
	onDelete: () => void;
}) {
	return (
		<aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l bg-background/98 p-5 shadow-2xl backdrop-blur">
			<div className="flex items-start justify-between gap-4">
				<div>
					<Badge variant="outline">{task.phase?.name ?? "Unphased"}</Badge>
					<h2 className="mt-2 font-semibold text-xl">{task.title}</h2>
				</div>
				<Button variant="ghost" onClick={onClose}>
					Close
				</Button>
			</div>
			<div className="mt-6 grid gap-4">
				<label className="grid gap-1" htmlFor="task-inspector-title">
					Title
					<Input
						id="task-inspector-title"
						defaultValue={task.title}
						onBlur={(event) =>
							event.target.value !== task.title &&
							onUpdate({ title: event.target.value })
						}
					/>
				</label>
				<label className="grid gap-1" htmlFor="task-inspector-description">
					Description
					<Textarea
						id="task-inspector-description"
						defaultValue={task.description ?? ""}
						onBlur={(event) => onUpdate({ description: event.target.value })}
					/>
				</label>
				<div className="grid grid-cols-2 gap-3">
					<label className="grid gap-1" htmlFor="task-inspector-phase">
						Phase
						<select
							id="task-inspector-phase"
							className="h-8 rounded-md border bg-background px-2"
							value={task.phase?.id ?? ""}
							onChange={(event) =>
								onUpdate({ phaseId: event.target.value || null })
							}
						>
							<option value="">No phase</option>
							{phases.map((phase) => (
								<option key={phase.id} value={phase.id}>
									{phase.name}
								</option>
							))}
						</select>
					</label>
					<label className="grid gap-1" htmlFor="task-inspector-estimate">
						Estimated minutes
						<Input
							id="task-inspector-estimate"
							type="number"
							min="0"
							defaultValue={task.estimatedMinutes}
							onBlur={(event) =>
								onUpdate({ estimatedMinutes: Number(event.target.value) })
							}
						/>
					</label>
					<label className="grid gap-1" htmlFor="task-inspector-start">
						Start date
						<Input
							id="task-inspector-start"
							type="date"
							defaultValue={inputDate(task.startDate)}
							onBlur={(event) =>
								onUpdate({ startDate: event.target.value || null })
							}
						/>
					</label>
					<label className="grid gap-1" htmlFor="task-inspector-due">
						Due date
						<Input
							id="task-inspector-due"
							type="date"
							defaultValue={inputDate(task.dueDate)}
							onBlur={(event) =>
								onUpdate({ dueDate: event.target.value || null })
							}
						/>
					</label>
				</div>
				<label className="grid gap-1" htmlFor="task-inspector-progress">
					Progress ({task.progress}%)
					<input
						id="task-inspector-progress"
						type="range"
						min="0"
						max="100"
						step="5"
						defaultValue={task.progress}
						className="accent-[#6cd32c]"
						onMouseUp={(event) =>
							onUpdate({ progress: Number(event.currentTarget.value) })
						}
						onTouchEnd={(event) =>
							onUpdate({ progress: Number(event.currentTarget.value) })
						}
					/>
				</label>
				<label
					className="flex items-center gap-2"
					htmlFor="task-client-visible"
				>
					<input
						id="task-client-visible"
						type="checkbox"
						checked={task.clientVisible}
						onChange={(event) =>
							onUpdate({ clientVisible: event.target.checked })
						}
					/>
					Visible in the client portal
				</label>
				<div>
					<h3 className="font-medium">Blocked by</h3>
					<div className="mt-2 flex flex-wrap gap-2">
						{task.blockedBy.map((item) => (
							<Badge key={item.blockedBy.id} variant="secondary">
								{item.blockedBy.title}
							</Badge>
						))}
					</div>
					<select
						className="mt-2 h-8 w-full rounded-md border bg-background px-2"
						defaultValue=""
						onChange={(event) => {
							if (event.target.value) onDependency(event.target.value);
							event.target.value = "";
						}}
					>
						<option value="">Add a dependency…</option>
						{tasks
							.filter(
								(item) =>
									item.id !== task.id &&
									!task.blockedBy.some(
										(dependency) => dependency.blockedBy.id === item.id,
									),
							)
							.map((item) => (
								<option key={item.id} value={item.id}>
									{item.title}
								</option>
							))}
					</select>
				</div>
				<div>
					<h3 className="font-medium">Internal discussion</h3>
					<div className="mt-2 grid gap-2">
						{task.comments.map((item) => (
							<div key={item.id} className="rounded-lg border p-3">
								<p>{item.body}</p>
								<p className="mt-1 text-muted-foreground">
									{item.author.name} · {dateLabel(item.createdAt)}
								</p>
							</div>
						))}
					</div>
					<form
						className="mt-2 grid gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							onComment();
						}}
					>
						<Textarea
							value={comment}
							onChange={(event) => setComment(event.target.value)}
							placeholder="Add an internal update"
							required
						/>
						<Button type="submit" disabled={!comment.trim()}>
							Post update
						</Button>
					</form>
				</div>
				<Button
					variant="outline"
					className="text-destructive"
					onClick={onDelete}
				>
					<TrashCan data-icon="inline-start" /> Delete task
				</Button>
			</div>
		</aside>
	);
}

function Progress({ value }: { value: number }) {
	return (
		<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
			<div
				className="h-full rounded-full bg-gradient-to-r from-[#6cd32c] to-[#49dcb1] transition-all"
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</div>
	);
}
function Empty({ text }: { text: string }) {
	return (
		<div className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">
			{text}
		</div>
	);
}

function ProjectManagerPanel({
	projectId,
	projectName,
	projectCompany,
	projectManager,
	platformUrl,
	isSyncing,
	syncDirection,
	onSync,
	lastSyncMessage,
	onSyncSettled,
}: {
	projectId: string;
	projectName: string;
	projectCompany: string;
	projectManager: string;
	platformUrl: string;
	isSyncing: boolean;
	syncDirection: "push" | "pull" | "full" | null;
	onSync: (direction: "push" | "pull" | "full") => void;
	lastSyncMessage: string | null;
	onSyncSettled: (message: string | null) => void;
}) {
	const projectManagerUrl = new URLSearchParams({
		projectId,
		projectName,
		company: projectCompany,
		projectManager,
	}).toString();
	const fullUrl = platformUrl
		? `${platformUrl}?${projectManagerUrl}`
		: "";

	return (
		<section className="grid gap-4 lg:grid-cols-2">
			<article className="rounded-xl border bg-card p-4">
				<h2 className="font-semibold">HCengineering / Project manager bridge</h2>
				<p className="mt-1 text-muted-foreground">
					Use this section to map Worklenz/HC-style project operations
					(roadmap, task groups, planning cycles and approvals) to this project.
				</p>
				<ul className="mt-4 grid gap-2 text-sm">
					<li>• Tasks and statuses are mirrored from this module.</li>
					<li>• Task comments and activity are queued for agent visibility.</li>
					<li>• Progress, timeline and workload context is preserved for the AI.</li>
					<li>• Project manager is linked from the Project owner profile.</li>
				</ul>
				{fullUrl ? (
					<div className="mt-4 grid gap-3">
						<div className="rounded-md border p-2">
							<p className="text-muted-foreground text-xs">Integrated endpoint</p>
							<p className="break-all text-xs">{platformUrl}</p>
						</div>
						<div className="flex flex-wrap gap-2">
							{(["full", "push", "pull"] as const).map((direction) => (
								<Button
									key={direction}
									variant="outline"
									disabled={isSyncing}
									onClick={() => {
										onSyncSettled(null);
										onSync(direction);
									}}
								>
									{isSyncing && syncDirection === direction
										? "Syncing..."
										: `${(direction[0] ?? "f").toUpperCase()}${direction.slice(1)} sync`}
								</Button>
							))}
						</div>
						<div className="rounded-md border overflow-hidden">
							<iframe
								title="Project manager workspace"
								src={fullUrl}
								className="h-[540px] w-full"
								sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
								allow="clipboard-read; clipboard-write; fullscreen"
							/>
						</div>
						<a
							className="inline-flex items-center justify-center rounded-md bg-[#6cd32c] px-3 py-2 text-sm font-medium text-black hover:bg-[#5fbe29]"
							href={fullUrl}
							target="_blank"
							rel="noreferrer"
						>
							Open in new tab (HC manager view)
						</a>
						{lastSyncMessage ? (
							<p className="text-sm text-muted-foreground">{lastSyncMessage}</p>
						) : null}
					</div>
				) : (
					<p className="mt-4 text-sm text-muted-foreground">
						Set NEXT_PUBLIC_PROJECT_MANAGER_PLATFORM_URL to expose the manager
						endpoint.
					</p>
				)}
			</article>
			<article className="rounded-xl border bg-card p-4">
				<h2 className="font-semibold">Connected workflow capabilities</h2>
				<div className="mt-4 grid gap-2 text-sm">
					<div className="rounded-md border p-3">
						<p className="font-medium">Capabilities pack</p>
						<p className="text-muted-foreground">
							Project plans, phase tracking, milestone control, review notes and
							delegation.
						</p>
					</div>
					<div className="rounded-md border p-3">
						<p className="font-medium">AI and staff visibility</p>
						<p className="text-muted-foreground">
							Every significant change here is routed as a project work item for
							agent processing and follow-up updates.
						</p>
					</div>
					<div className="rounded-md border p-3">
						<p className="font-medium">Ready-to-connect actions</p>
						<p className="text-muted-foreground">
							Enable your HCengine-style project workspace on this endpoint and
							we can sync client-level artifacts back into this board.
						</p>
					</div>
				</div>
			</article>
		</section>
	);
}
function label(value: string) {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/^./, (character) => character.toUpperCase());
}
function duration(minutes: number) {
	if (!minutes) return "0h";
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}
function dateLabel(value?: string | null) {
	if (!value) return "Not set";
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}
function inputDate(value?: string | null) {
	return value ? value.slice(0, 10) : "";
}
