"use client";

import Renew from "@carbon/icons-react/es/Renew";
import Send from "@carbon/icons-react/es/Send";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type Row = Record<string, unknown>;
export function PaperclipAgentDetail({ agentId }: { agentId: string }) {
	const trpc = useTRPC();
	const [message, setMessage] = useState("");
	const query = useQuery({
		...trpc.paperclip.agent.queryOptions({ agentId }),
		refetchInterval: 5000,
	});
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const canManage = workspace.data?.permissions.manageAgents ?? false;
	const instruction = useMutation(
		trpc.paperclip.instruction.mutationOptions({
			onSuccess: async (result) => {
				setMessage("");
				toast.success(
					result.offline
						? "Paperclip is offline. Instruction queued."
						: "Instruction sent to agent.",
				);
				await query.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const approval = useMutation(
		trpc.paperclip.approval.mutationOptions({
			onSuccess: async (result) => {
				toast.success(
					result.offline ? "Decision queued for sync." : "Decision sent.",
				);
				await query.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const workflow = useMutation(
		trpc.paperclip.workflow.mutationOptions({
			onSuccess: (result) =>
				toast.success(
					result.offline ? "Workflow queued for sync." : "Workflow started.",
				),
			onError: (error) => toast.error(error.message),
		}),
	);
	const sync = useMutation(
		trpc.paperclip.sync.mutationOptions({
			onSuccess: async () => {
				await query.refetch();
				toast.success("Paperclip sync attempted.");
			},
		}),
	);
	const data = query.data;
	const agent = (data?.agent ?? {}) as Row;
	const activities = (data?.activity ?? []) as Row[];
	const approvals = (data?.approvals ?? []) as Row[];
	const routines = (
		Array.isArray(data?.routines) ? data.routines : []
	) as Row[];
	return (
		<main className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
			<div className="mx-auto flex max-w-5xl flex-col gap-6">
				<header className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div className="mb-2 flex items-center gap-2">
							<Badge variant={data?.connected ? "default" : "secondary"}>
								{data?.connected ? "Live" : "Offline cache"}
							</Badge>
							{(data?.queued ?? 0) > 0 ? (
								<Badge variant="secondary">{data?.queued} queued</Badge>
							) : null}
						</div>
						<h1 className="text-2xl font-semibold">
							{String(agent.name ?? "Paperclip agent")}
						</h1>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							{String(
								agent.capabilities ?? agent.title ?? "Paperclip team agent",
							)}
						</p>
					</div>
					{canManage ? (
						<Button
							variant="outline"
							disabled={sync.isPending}
							onClick={() => sync.mutate()}
						>
							<Icon icon={Renew} />
							Sync now
						</Button>
					) : null}
				</header>
				<section className="rounded-xl border bg-card p-4">
					<h2 className="font-medium">Talk to this agent</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						Instructions are retained in the CRM outbox if Paperclip is offline.
					</p>
					<Textarea
						className="mt-4 min-h-28"
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						placeholder="Ask for an update, assign work, or request an insight…"
					/>
					<div className="mt-3 flex justify-end">
						<Button
							disabled={!message.trim() || instruction.isPending}
							onClick={() => instruction.mutate({ agentId, message })}
						>
							<Icon icon={Send} />
							Send instruction
						</Button>
					</div>
				</section>
				{canManage ? (
					<div className="grid gap-6 lg:grid-cols-2">
						<section className="rounded-xl border bg-card p-4">
							<h2 className="font-medium">Approvals</h2>
							<div className="mt-3 flex flex-col gap-3">
								{approvals.length ? (
									approvals.map((item) => (
										<div
											key={String(item.id)}
											className="rounded-lg border p-3"
										>
											<p className="text-sm">
												{String(item.type ?? "Approval request")}
											</p>
											<p className="text-xs text-muted-foreground">
												{String(item.status ?? "pending")}
											</p>
											{item.status === "pending" ? (
												<div className="mt-3 flex gap-2">
													<Button
														size="sm"
														onClick={() =>
															approval.mutate({
																approvalId: String(item.id),
																action: "approve",
															})
														}
													>
														Approve
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															approval.mutate({
																approvalId: String(item.id),
																action: "reject",
															})
														}
													>
														Reject
													</Button>
												</div>
											) : null}
										</div>
									))
								) : (
									<p className="text-sm text-muted-foreground">
										No pending approvals for this agent.
									</p>
								)}
							</div>
						</section>
						<section className="rounded-xl border bg-card p-4">
							<h2 className="font-medium">Workflows</h2>
							<div className="mt-3 flex flex-col gap-2">
								{routines.length ? (
									routines.map((item) => (
										<div
											key={String(item.id)}
											className="flex items-center gap-3 rounded-lg border p-3"
										>
											<span className="min-w-0 flex-1 truncate text-sm">
												{String(item.name ?? item.title ?? "Paperclip routine")}
											</span>
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													workflow.mutate({
														routineId: String(item.id),
														payload: {},
													})
												}
											>
												Run
											</Button>
										</div>
									))
								) : (
									<p className="text-sm text-muted-foreground">
										No routines available.
									</p>
								)}
							</div>
						</section>
					</div>
				) : null}
				<section className="rounded-xl border bg-card p-4">
					<h2 className="font-medium">Live updates and insights</h2>
					<div className="mt-3 grid gap-3 sm:grid-cols-3">
						<Insight
							label="Agent status"
							value={String(agent.status ?? "unknown")}
						/>
						<Insight label="Updates loaded" value={String(activities.length)} />
						<Insight
							label="Pending approvals"
							value={String(
								approvals.filter((item) => item.status === "pending").length,
							)}
						/>
					</div>
					<div className="mt-4 flex flex-col divide-y">
						{activities.slice(0, 20).map((item) => (
							<div key={String(item.id)} className="py-3">
								<p className="text-sm">
									{String(
										(item.details as Row | undefined)?.bodySnippet ??
											item.action ??
											"Agent update",
									)}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{String(item.createdAt ?? "")}
								</p>
							</div>
						))}
					</div>
				</section>
			</div>
		</main>
	);
}

function Insight({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg bg-accent p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 font-medium capitalize">{value}</p>
		</div>
	);
}
