"use client";

import Add from "@carbon/icons-react/es/Add";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { CardContent } from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function ProjectsWorkspace() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [companyId, setCompanyId] = useState("");
	const [ownerId, setOwnerId] = useState("");
	const projects = useQuery(
		trpc.projects.list.queryOptions({
			q: "",
			page: 1,
			pageSize: 100,
			sort: "createdAt",
			dir: "desc",
			status: "all",
			owner: "all",
		}),
	);
	const users = useQuery(trpc.users.list.queryOptions());
	const companies = useQuery(trpc.companies.options.queryOptions({ q: "" }));
	const me = useQuery(trpc.users.me.queryOptions());
	const create = useMutation(
		trpc.projects.create.mutationOptions({
			onSuccess: async (project) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.projects.list.queryKey(),
				});
				setName("");
				setShowForm(false);
				toast.success(`${project.name} created.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const resolvedOwner = ownerId || me.data?.id || "";

	return (
		<div className="flex flex-col gap-5">
			<div className="flex justify-end">
				<Button onClick={() => setShowForm((value) => !value)}>
					<Add data-icon="inline-start" /> New project
				</Button>
			</div>
			{showForm ? (
				<CardContent>
					<form
						className="grid gap-4 md:grid-cols-3"
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate({
								name,
								companyId: companyId || null,
								ownerId: resolvedOwner,
								currency: "JMD",
							});
						}}
					>
						<label className="grid gap-1 text-sm" htmlFor="project-name">
							Project name
							<Input
								id="project-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
							/>
						</label>
						<label className="grid gap-1 text-sm">
							Client
							<select
								className="h-9 rounded-md border bg-background px-3"
								value={companyId}
								onChange={(event) => setCompanyId(event.target.value)}
							>
								<option value="">Internal project</option>
								{(companies.data ?? []).map((company) => (
									<option key={company.id} value={company.id}>
										{company.name}
									</option>
								))}
							</select>
						</label>
						<label className="grid gap-1 text-sm">
							Project manager
							<select
								className="h-9 rounded-md border bg-background px-3"
								value={resolvedOwner}
								onChange={(event) => setOwnerId(event.target.value)}
								required
							>
								<option value="">Choose an owner</option>
								{(users.data ?? []).map((user) => (
									<option key={user.id} value={user.id}>
										{user.name}
									</option>
								))}
							</select>
						</label>
						<Button
							type="submit"
							className="md:col-start-3"
							disabled={!name.trim() || !resolvedOwner || create.isPending}
						>
							Create project
						</Button>
					</form>
				</CardContent>
			) : null}
			<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
				{(projects.data?.rows ?? []).map((project) => {
					const completion =
						project.taskCount === 0
							? 0
							: Math.round(
									(project.completedTaskCount / project.taskCount) * 100,
								);
					return (
						<Link
							key={project.id}
							href={workspaceUrl(`/projects/${project.id}`)}
							className="rounded-lg border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30"
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<h2 className="font-medium">{project.name}</h2>
									<p className="mt-1 text-muted-foreground text-sm">
										{project.company?.name ?? "Internal"}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Project manager: {project.owner?.name ?? "Unassigned"}
									</p>
								</div>
								<Badge variant="outline">{label(project.status)}</Badge>
							</div>
							<div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
								<div
									className="h-full bg-primary"
									style={{ width: `${completion}%` }}
								/>
							</div>
							<div className="mt-2 flex justify-between text-muted-foreground text-xs">
								<span>
									{project.completedTaskCount}/{project.taskCount} tasks
								</span>
								<span>
									{project.budgetCents === null
										? "No budget"
										: formatMoney(project.budgetCents, project.currency)}
								</span>
							</div>
						</Link>
					);
				})}
			</div>
			{projects.data?.rows.length === 0 ? (
				<p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
					Create the first VAYU delivery project.
				</p>
			) : null}
		</div>
	);
}

function label(value: string): string {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/^./, (character) => character.toUpperCase());
}
