"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
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
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export function ProjectBoard({ projectId }: { projectId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [title, setTitle] = useState("");
	const project = useQuery(trpc.projects.byId.queryOptions({ id: projectId }));
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.projects.byId.queryKey({ id: projectId }),
		});
	const createTask = useMutation(
		trpc.projects.createTask.mutationOptions({
			onSuccess: async () => {
				setTitle("");
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

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{project.data?.name ?? "Project"}</PageShellTitle>
					<PageShellDescription>
						{project.data?.description ??
							`${project.data?.company?.name ?? "Internal"} delivery workspace`}
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Link
					href={workspaceUrl("/projects")}
					className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft /> Projects
				</Link>
				<form
					className="flex max-w-xl gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						createTask.mutate({ projectId, title });
					}}
				>
					<Input
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						placeholder="Add the next task"
						aria-label="Task title"
						required
					/>
					<Button
						type="submit"
						disabled={!title.trim() || createTask.isPending}
					>
						Add task
					</Button>
				</form>
				<div className="grid gap-4 xl:grid-cols-4">
					{STATUSES.map((status) => (
						<section
							key={status}
							className="min-h-64 rounded-lg bg-muted/45 p-3"
							aria-labelledby={`column-${status}`}
						>
							<div className="mb-3 flex items-center justify-between">
								<h2 id={`column-${status}`} className="font-medium text-sm">
									{label(status)}
								</h2>
								<Badge variant="secondary">
									{project.data?.tasks.filter((task) => task.status === status)
										.length ?? 0}
								</Badge>
							</div>
							<div className="grid gap-2">
								{project.data?.tasks
									.filter((task) => task.status === status)
									.map((task) => (
										<article
											key={task.id}
											className="rounded-md border bg-card p-3 shadow-xs"
										>
											<p className="font-medium text-sm">{task.title}</p>
											<div className="mt-3 flex items-center justify-between gap-2">
												<Badge variant="outline">{label(task.priority)}</Badge>
												<select
													aria-label={`Status for ${task.title}`}
													className="h-8 rounded-md border bg-background px-2 text-xs"
													value={task.status}
													onChange={(event) =>
														updateTask.mutate({
															id: task.id,
															status: event.target.value as never,
														})
													}
												>
													{STATUSES.map((option) => (
														<option key={option} value={option}>
															{label(option)}
														</option>
													))}
												</select>
											</div>
										</article>
									))}
							</div>
						</section>
					))}
				</div>
			</PageShellContent>
		</PageShell>
	);
}

function label(value: string): string {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/^./, (character) => character.toUpperCase());
}
