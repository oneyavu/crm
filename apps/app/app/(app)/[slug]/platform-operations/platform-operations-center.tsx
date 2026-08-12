"use client";

import Checkmark from "@carbon/icons-react/es/Checkmark";
import Launch from "@carbon/icons-react/es/Launch";
import Renew from "@carbon/icons-react/es/Renew";
import Security from "@carbon/icons-react/es/Security";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

const INQUIRY_STATUSES = [
	"NEW",
	"TRIAGED",
	"QUALIFIED",
	"CONVERTED",
	"CLOSED",
	"SPAM",
] as const;

type PlatformKind = "WEBSITE" | "SUPRCREATE" | "ONECARD" | "ONEDIGITAL";

export function PlatformOperationsCenter() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [query, setQuery] = useState("");
	const [workspace, setWorkspace] = useState<PlatformKind>("ONEDIGITAL");
	const [actionPlatform, setActionPlatform] =
		useState<PlatformKind>("ONEDIGITAL");
	const [actionKind, setActionKind] = useState("");
	const [actionSummary, setActionSummary] = useState("");
	const dashboard = useQuery(
		trpc.platformOperations.dashboard.queryOptions(undefined, {
			refetchInterval: 30_000,
		}),
	);
	const inquiries = useQuery(
		trpc.platformOperations.inquiries.queryOptions({ q: query, limit: 100 }),
	);
	const actions = useQuery(trpc.platformOperations.actions.queryOptions());

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.platformOperations.dashboard.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.platformOperations.inquiries.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.platformOperations.actions.queryKey(),
			}),
		]);

	const health = useMutation(
		trpc.platformOperations.checkHealth.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Platform health refreshed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const updateInquiry = useMutation(
		trpc.platformOperations.updateInquiry.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const verifyReadOnly = useMutation(
		trpc.platformOperations.markReadOnlyVerified.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Read-only connector verified.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const writeAccess = useMutation(
		trpc.platformOperations.setWriteAccess.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const decide = useMutation(
		trpc.platformOperations.decideAction.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const requestAction = useMutation(
		trpc.platformOperations.requestAction.mutationOptions({
			onSuccess: async () => {
				setActionKind("");
				setActionSummary("");
				await refresh();
				toast.success("Action submitted for separate approval.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const connections = dashboard.data?.connections ?? [];
	const selected = useMemo(
		() => connections.find((item) => item.kind === workspace),
		[connections, workspace],
	);
	const counts = dashboard.data?.inquiryCounts ?? {};

	return (
		<div className="flex flex-col gap-6">
			<Alert>
				<Security />
				<AlertTitle>Administrator workspace</AlertTitle>
				<AlertDescription>
					This route and every supporting API operation require workspace
					administrator access. Platform passwords are never stored by V-OS.
				</AlertDescription>
			</Alert>

			<div className="grid gap-4 border-y py-5 sm:grid-cols-2 xl:grid-cols-4">
				<Metric label="New inquiries" value={String(counts.NEW ?? 0)} />
				<Metric
					label="Healthy platforms"
					value={`${connections.filter((item) => item.healthStatus === "HEALTHY").length}/${connections.length}`}
				/>
				<Metric
					label="Alerts · 24 hours"
					value={String(dashboard.data?.alertsLast24Hours ?? 0)}
				/>
				<Metric
					label="Awaiting approval"
					value={String(dashboard.data?.pendingApprovals ?? 0)}
				/>
			</div>

			<Tabs defaultValue="overview">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="inquiries">Inquiries</TabsTrigger>
					<TabsTrigger value="workspaces">Admin workspaces</TabsTrigger>
					<TabsTrigger value="approvals">Approvals</TabsTrigger>
				</TabsList>

				<TabsContent value="overview">
					<section className="rounded-lg border">
						<div className="flex flex-wrap items-center gap-3 border-b p-4">
							<div>
								<h2 className="font-medium">Connected platforms</h2>
								<p className="text-sm text-muted-foreground">
									Read-only health, synchronized updates and controlled admin
									access.
								</p>
							</div>
							<Button
								variant="outline"
								onClick={() => health.mutate()}
								disabled={health.isPending}
							>
								<Renew data-icon="inline-start" />
								Refresh health
							</Button>
						</div>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Platform</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Last check</TableHead>
									<TableHead>Read-only</TableHead>
									<TableHead>Approved writes</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{connections.map((connection) => (
									<TableRow key={connection.id}>
										<TableCell>
											<p className="font-medium">{connection.name}</p>
											<p className="text-muted-foreground">{connection.kind}</p>
										</TableCell>
										<TableCell>
											<StatusBadge status={connection.healthStatus} />
										</TableCell>
										<TableCell>
											{formatDate(connection.lastCheckedAt)}
										</TableCell>
										<TableCell>
											{connection.readOnlyVerifiedAt ? "Verified" : "Pending"}
										</TableCell>
										<TableCell>
											{connection.writeEnabled ? "Enabled" : "Disabled"}
										</TableCell>
										<TableCell>
											<div className="flex gap-2">
												{!connection.readOnlyVerifiedAt ? (
													<Button
														variant="outline"
														size="sm"
														disabled={connection.healthStatus !== "HEALTHY"}
														onClick={() =>
															verifyReadOnly.mutate({ kind: connection.kind })
														}
													>
														<Checkmark data-icon="inline-start" /> Verify
													</Button>
												) : (
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															writeAccess.mutate({
																kind: connection.kind,
																enabled: !connection.writeEnabled,
																confirmation: !connection.writeEnabled
																	? "ENABLE APPROVED WRITES"
																	: undefined,
															})
														}
													>
														{connection.writeEnabled
															? "Disable writes"
															: "Enable writes"}
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</section>
				</TabsContent>

				<TabsContent value="inquiries">
					<section className="rounded-lg border">
						<div className="border-b p-4">
							<Input
								aria-label="Search inquiries"
								placeholder="Search reference, company, contact or email"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
						</div>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Inquiry</TableHead>
									<TableHead>Source</TableHead>
									<TableHead>Client</TableHead>
									<TableHead>Request</TableHead>
									<TableHead>Received</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(inquiries.data ?? []).map((inquiry) => (
									<TableRow key={inquiry.id}>
										<TableCell>
											<p className="font-medium">{inquiry.reference}</p>
											<p className="text-muted-foreground">{inquiry.email}</p>
										</TableCell>
										<TableCell>{inquiry.source}</TableCell>
										<TableCell>
											{inquiry.company?.name ??
												inquiry.organizationName ??
												"Unassigned"}
										</TableCell>
										<TableCell>
											<p className="max-w-80 truncate">
												{inquiry.challenge ??
													inquiry.desiredOutcome ??
													inquiry.notes ??
													"—"}
											</p>
										</TableCell>
										<TableCell>{formatDate(inquiry.createdAt)}</TableCell>
										<TableCell>
											<Select
												value={inquiry.status}
												onValueChange={(status) =>
													updateInquiry.mutate({
														id: inquiry.id,
														status: status as (typeof INQUIRY_STATUSES)[number],
													})
												}
											>
												<SelectTrigger size="sm">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{INQUIRY_STATUSES.map((status) => (
														<SelectItem key={status} value={status}>
															{status}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</section>
				</TabsContent>

				<TabsContent value="workspaces">
					<div className="flex flex-col gap-4">
						<div className="flex flex-wrap gap-2">
							{connections.map((connection) => (
								<Button
									key={connection.kind}
									variant={
										workspace === connection.kind ? "default" : "outline"
									}
									onClick={() => setWorkspace(connection.kind)}
								>
									{connection.name}
								</Button>
							))}
						</div>
						{selected?.embedAllowed && selected.embedUrl ? (
							<section className="overflow-hidden rounded-lg border">
								<div className="flex items-center gap-3 border-b p-3">
									<div>
										<p className="font-medium">{selected.name}</p>
										<p className="text-xs text-muted-foreground">
											Authenticated session contained inside the V-OS admin
											shell
										</p>
									</div>
									<Badge variant="outline">Admin only</Badge>
								</div>
								<iframe
									key={selected.embedUrl}
									title={`${selected.name} administration`}
									src={selected.embedUrl}
									className="h-[72vh] w-full bg-background"
									sandbox="allow-forms allow-scripts allow-same-origin allow-downloads"
									referrerPolicy="no-referrer"
								/>
							</section>
						) : (
							<Alert>
								<Launch />
								<AlertTitle>
									{selected?.name ?? "Platform"} API workspace
								</AlertTitle>
								<AlertDescription>
									This service blocks safe cross-origin embedding. Its common
									admin tasks and synchronized data remain available through the
									V-OS connector without weakening frame security.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</TabsContent>

				<TabsContent value="approvals">
					<div className="flex flex-col gap-4">
						<section className="rounded-lg border p-4">
							<h2 className="font-medium">Request an external action</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								The request cannot run until another explicit administrator
								approval queues it to Paperclip.
							</p>
							<div className="mt-4 grid gap-3 md:grid-cols-[12rem_1fr]">
								<Select
									value={actionPlatform}
									onValueChange={(value) =>
										setActionPlatform(value as PlatformKind)
									}
								>
									<SelectTrigger aria-label="Platform">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{connections.map((connection) => (
											<SelectItem key={connection.kind} value={connection.kind}>
												{connection.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Input
									aria-label="Action type"
									placeholder="Action type, for example campaign.publish"
									value={actionKind}
									onChange={(event) => setActionKind(event.target.value)}
								/>
							</div>
							<div className="mt-3">
								<Textarea
									aria-label="Action summary"
									placeholder="Describe exactly what should change and the expected outcome"
									value={actionSummary}
									onChange={(event) => setActionSummary(event.target.value)}
								/>
							</div>
							<div className="mt-3">
								<Button
									disabled={!actionKind.trim() || !actionSummary.trim()}
									onClick={() =>
										requestAction.mutate({
											kind: actionPlatform,
											action: actionKind,
											summary: actionSummary,
											payload: {},
										})
									}
								>
									Submit for approval
								</Button>
							</div>
						</section>
						<section className="rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Platform</TableHead>
										<TableHead>Requested action</TableHead>
										<TableHead>Requester</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Decision</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(actions.data ?? []).map((action) => (
										<TableRow key={action.id}>
											<TableCell>{action.connection.name}</TableCell>
											<TableCell>
												<p className="font-medium">{action.kind}</p>
												<p className="text-muted-foreground">
													{action.summary}
												</p>
											</TableCell>
											<TableCell>{action.requestedBy.name}</TableCell>
											<TableCell>
												<Badge variant="outline">{action.status}</Badge>
											</TableCell>
											<TableCell>
												{action.status === "PENDING_APPROVAL" ? (
													<div className="flex gap-2">
														<Button
															size="sm"
															onClick={() =>
																decide.mutate({
																	id: action.id,
																	decision: "APPROVE",
																})
															}
														>
															Approve
														</Button>
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																decide.mutate({
																	id: action.id,
																	decision: "REJECT",
																})
															}
														>
															Reject
														</Button>
													</div>
												) : (
													"Decided"
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</section>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-2 text-3xl tabular-nums tracking-tight">{value}</p>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	return (
		<Badge variant={status === "HEALTHY" ? "default" : "outline"}>
			{status}
		</Badge>
	);
}

function formatDate(value: Date | string | null) {
	if (!value) return "Never";
	return new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
