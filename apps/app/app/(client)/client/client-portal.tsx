"use client";

import Add from "@carbon/icons-react/es/Add";
import Calendar from "@carbon/icons-react/es/Calendar";
import Chat from "@carbon/icons-react/es/Chat";
import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import Dashboard from "@carbon/icons-react/es/Dashboard";
import Document from "@carbon/icons-react/es/Document";
import Logout from "@carbon/icons-react/es/Logout";
import Receipt from "@carbon/icons-react/es/Receipt";
import Send from "@carbon/icons-react/es/Send";
import Task from "@carbon/icons-react/es/Task";
import Video from "@carbon/icons-react/es/Video";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Input } from "@crm/ui/components/input";
import { Skeleton } from "@crm/ui/components/skeleton";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "api/app-router";
import { useState } from "react";
import { toast } from "sonner";
import { VayuMark, VayuWordmark } from "@/components/vayu-brand";
import { signOutAndRedirect } from "@/lib/sign-out";
import { useTRPC } from "@/lib/trpc/client";

type View =
	| "overview"
	| "projects"
	| "billing"
	| "requests"
	| "meetings"
	| "assistant";

type PortalData = inferRouterOutputs<AppRouter>["portal"]["mine"];
type PortalProject = PortalData["projects"][number];
type PortalConversation = PortalData["supportConversations"][number];
type PortalInvoice = PortalData["invoices"][number];

const NAV: Array<{ id: View; label: string; icon: typeof Dashboard }> = [
	{ id: "overview", label: "Overview", icon: Dashboard },
	{ id: "projects", label: "Projects", icon: Task },
	{ id: "billing", label: "Billing", icon: Receipt },
	{ id: "requests", label: "Service Requests", icon: Chat },
	{ id: "meetings", label: "Meetings", icon: Calendar },
	{ id: "assistant", label: "AI Assistant", icon: CheckmarkFilled },
];

export function ClientPortal({ userName }: { userName: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const portal = useQuery(trpc.portal.mine.queryOptions());
	const [view, setView] = useState<View>("overview");
	const [requestOpen, setRequestOpen] = useState(false);
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
		null,
	);
	const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
		null,
	);
	const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
	const [assistantMessage, setAssistantMessage] = useState("");
	const [requestTitle, setRequestTitle] = useState("");
	const [requestDescription, setRequestDescription] = useState("");
	const [requestCategory, setRequestCategory] = useState("SUPPORT");
	const [requestPriority, setRequestPriority] = useState("MEDIUM");
	const [requestProjectId, setRequestProjectId] = useState("");
	const [requestReply, setRequestReply] = useState("");

	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: trpc.portal.mine.queryKey() });
	const createRequest = useMutation(
		trpc.portal.createServiceRequest.mutationOptions({
			onSuccess: async (created) => {
				await refresh();
				setSelectedRequestId(created.id);
				setRequestOpen(false);
				setRequestTitle("");
				setRequestDescription("");
				toast.success(`${created.reference} created.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const replyToRequest = useMutation(
		trpc.portal.replyToServiceRequest.mutationOptions({
			onSuccess: async () => {
				setRequestReply("");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const aiChat = useMutation(
		trpc.portal.aiChat.mutationOptions({
			onSuccess: async () => {
				setAssistantMessage("");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const data = portal.data;
	const selectedRequest =
		data?.serviceRequests.find((request) => request.id === selectedRequestId) ??
		null;
	const selectedInvoice =
		data?.invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
	const payInvoice =
		data?.invoices.find((invoice) => invoice.id === payInvoiceId) ?? null;
	const aiConversation = data?.supportConversations[0] ?? null;
	const currency = data?.invoices[0]?.currency ?? "JMD";

	return (
		<div className="min-h-svh bg-[#090a0a] text-[#f5f3ef]">
			<header className="sticky top-0 z-30 border-white/10 border-b bg-[#090a0a]/95 px-4 py-3 backdrop-blur sm:px-6">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#71ed75] to-[#55d9bd] text-black">
						<VayuMark className="size-7" />
					</div>
					<div>
						<p className="font-medium">VAYU Client Control</p>
						<p className="text-[11px] text-white/40">
							Delivery, billing and support
						</p>
					</div>
					<div className="ml-auto flex items-center gap-3">
						{data?.ai.configured ? (
							<span className="hidden items-center gap-2 text-xs text-white/55 sm:flex">
								<span className="size-2 rounded-full bg-[#71ed75]" />
								GPT-5.5 connected
							</span>
						) : null}
						<span className="hidden text-sm text-white/50 md:block">
							{userName}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => signOutAndRedirect()}
						>
							<Logout data-icon="inline-start" /> Sign out
						</Button>
					</div>
				</div>
			</header>

			<div className="mx-auto flex max-w-[96rem]">
				<aside className="sticky top-[65px] hidden h-[calc(100svh-65px)] w-60 shrink-0 flex-col border-white/10 border-r p-4 md:flex">
					<div className="mb-8 px-3 py-2">
						<VayuWordmark />
					</div>
					<nav className="space-y-1">
						{NAV.map((item) => {
							const Icon = item.icon;
							return (
								<button
									key={item.id}
									type="button"
									onClick={() => setView(item.id)}
									className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${view === item.id ? "bg-white/10 text-white" : "text-white/48 hover:bg-white/[0.05] hover:text-white/80"}`}
								>
									<Icon className={view === item.id ? "text-[#7bff5a]" : ""} />
									{item.label}
								</button>
							);
						})}
					</nav>
					<div className="mt-auto rounded-xl border border-white/10 bg-white/[0.035] p-3">
						<p className="truncate text-sm">{data?.name ?? "Client portal"}</p>
						<p className="mt-1 truncate text-xs text-white/35">{userName}</p>
					</div>
				</aside>

				<main className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
					<div className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden">
						{NAV.map((item) => (
							<Button
								key={item.id}
								size="sm"
								variant={view === item.id ? "default" : "outline"}
								onClick={() => setView(item.id)}
							>
								{item.label}
							</Button>
						))}
					</div>
					{portal.isLoading ? <PortalSkeleton /> : null}
					{portal.isError ? <AccessError /> : null}
					{data ? (
						<>
							{view === "overview" ? (
								<Overview data={data} currency={currency} onView={setView} />
							) : null}
							{view === "projects" ? <Projects data={data} /> : null}
							{view === "billing" ? (
								<Billing
									data={data}
									onInvoice={setSelectedInvoiceId}
									onPay={setPayInvoiceId}
								/>
							) : null}
							{view === "requests" ? (
								<Requests
									data={data}
									selectedId={selectedRequestId}
									onSelect={setSelectedRequestId}
									onNew={() => setRequestOpen(true)}
								/>
							) : null}
							{view === "meetings" ? <Meetings data={data} /> : null}
							{view === "assistant" ? (
								<Assistant
									data={data}
									conversation={aiConversation}
									value={assistantMessage}
									onChange={setAssistantMessage}
									pending={aiChat.isPending}
									onSend={() =>
										aiChat.mutate({
											conversationId: aiConversation?.id ?? null,
											message: assistantMessage,
										})
									}
								/>
							) : null}
						</>
					) : null}
				</main>
			</div>

			<Dialog open={requestOpen} onOpenChange={setRequestOpen}>
				<DialogContent className="border-white/10 bg-[#151616] text-white sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>New service request</DialogTitle>
						<DialogDescription>
							Send a trackable request directly to your VAYU team.
						</DialogDescription>
					</DialogHeader>
					<form
						className="grid gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							createRequest.mutate({
								title: requestTitle,
								description: requestDescription,
								category: requestCategory as never,
								priority: requestPriority as never,
								projectId: requestProjectId || null,
							});
						}}
					>
						<label className="grid gap-1.5 text-sm" htmlFor="request-subject">
							Subject
							<Input
								id="request-subject"
								value={requestTitle}
								onChange={(event) => setRequestTitle(event.target.value)}
								required
							/>
						</label>
						<div className="grid gap-4 sm:grid-cols-2">
							<label
								className="grid gap-1.5 text-sm"
								htmlFor="request-category"
							>
								Category
								<select
									id="request-category"
									className="h-9 rounded-md border border-white/10 bg-[#0e0f0f] px-3"
									value={requestCategory}
									onChange={(event) => setRequestCategory(event.target.value)}
								>
									<option value="SUPPORT">Support</option>
									<option value="CHANGE_REQUEST">Change request</option>
									<option value="BILLING">Billing</option>
									<option value="ACCESS">Access</option>
									<option value="INTEGRATION">Integration</option>
									<option value="OTHER">Other</option>
								</select>
							</label>
							<label
								className="grid gap-1.5 text-sm"
								htmlFor="request-priority"
							>
								Priority
								<select
									id="request-priority"
									className="h-9 rounded-md border border-white/10 bg-[#0e0f0f] px-3"
									value={requestPriority}
									onChange={(event) => setRequestPriority(event.target.value)}
								>
									<option value="LOW">Low</option>
									<option value="MEDIUM">Medium</option>
									<option value="HIGH">High</option>
									<option value="URGENT">Urgent</option>
								</select>
							</label>
						</div>
						<label className="grid gap-1.5 text-sm" htmlFor="request-project">
							Related project
							<select
								id="request-project"
								className="h-9 rounded-md border border-white/10 bg-[#0e0f0f] px-3"
								value={requestProjectId}
								onChange={(event) => setRequestProjectId(event.target.value)}
							>
								<option value="">General account request</option>
								{data?.projects.map((project) => (
									<option key={project.id} value={project.id}>
										{project.name}
									</option>
								))}
							</select>
						</label>
						<label
							className="grid gap-1.5 text-sm"
							htmlFor="request-description"
						>
							Description
							<Textarea
								id="request-description"
								rows={6}
								value={requestDescription}
								onChange={(event) => setRequestDescription(event.target.value)}
								required
							/>
						</label>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setRequestOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createRequest.isPending}>
								<Add data-icon="inline-start" /> Submit request
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(selectedRequest)}
				onOpenChange={(open) => !open && setSelectedRequestId(null)}
			>
				<DialogContent className="max-h-[88svh] overflow-y-auto border-white/10 bg-[#151616] text-white sm:max-w-2xl">
					{selectedRequest ? (
						<>
							<DialogHeader>
								<p className="text-xs text-[#7bff5a]">
									{selectedRequest.reference}
								</p>
								<DialogTitle>{selectedRequest.title}</DialogTitle>
								<DialogDescription>
									{label(selectedRequest.category)} · Updated{" "}
									{dateTimeLabel(selectedRequest.updatedAt)}
								</DialogDescription>
							</DialogHeader>
							<div className="flex gap-2">
								<StatusBadge value={selectedRequest.status} />
								<StatusBadge value={selectedRequest.priority} />
							</div>
							<div className="space-y-3 py-2">
								{selectedRequest.messages.map((message) => (
									<article
										key={message.id}
										className={`rounded-xl border p-4 ${message.source === "CLIENT" ? "border-white/10 bg-white/[0.035]" : "border-[#7bff5a]/20 bg-[#7bff5a]/[0.06]"}`}
									>
										<div className="flex justify-between gap-3 text-xs">
											<span className="font-medium text-white/75">
												{message.source === "CLIENT"
													? "You"
													: (message.authorUser?.name ?? "VAYU Support")}
											</span>
											<span className="text-white/35">
												{dateTimeLabel(message.createdAt)}
											</span>
										</div>
										<p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/68">
											{message.body}
										</p>
									</article>
								))}
							</div>
							<form
								className="flex gap-2"
								onSubmit={(event) => {
									event.preventDefault();
									if (requestReply.trim())
										replyToRequest.mutate({
											requestId: selectedRequest.id,
											message: requestReply,
										});
								}}
							>
								<Input
									value={requestReply}
									onChange={(event) => setRequestReply(event.target.value)}
									placeholder="Write an update…"
								/>
								<Button
									type="submit"
									disabled={!requestReply.trim() || replyToRequest.isPending}
								>
									<Send />
								</Button>
							</form>
						</>
					) : null}
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(selectedInvoice)}
				onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
			>
				<DialogContent className="max-h-[88svh] overflow-y-auto border-white/10 bg-[#151616] text-white sm:max-w-2xl">
					{selectedInvoice ? (
						<>
							<DialogHeader>
								<DialogTitle>Invoice {selectedInvoice.number}</DialogTitle>
								<DialogDescription>
									Issued {dateLabel(selectedInvoice.issueDate)} · Due{" "}
									{dateLabel(selectedInvoice.dueDate)}
								</DialogDescription>
							</DialogHeader>
							<div className="flex items-end justify-between rounded-xl bg-gradient-to-br from-[#71ed75] to-[#55d9bd] p-5 text-black">
								<div>
									<p className="text-xs uppercase tracking-wider opacity-65">
										Balance due
									</p>
									<p className="mt-1 text-3xl">
										{formatMoney(
											Math.max(
												0,
												selectedInvoice.totalCents -
													selectedInvoice.amountPaidCents,
											),
											selectedInvoice.currency,
										)}
									</p>
								</div>
								<StatusBadge value={selectedInvoice.status} />
							</div>
							<div className="divide-y divide-white/10">
								{selectedInvoice.lines.map((line) => (
									<div
										key={line.id}
										className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm"
									>
										<div>
											<p>{line.description}</p>
											<p className="mt-1 text-xs text-white/35">
												{line.quantity} ×{" "}
												{formatMoney(
													line.unitPriceCents,
													selectedInvoice.currency,
												)}
											</p>
										</div>
										<p>
											{formatMoney(line.amountCents, selectedInvoice.currency)}
										</p>
									</div>
								))}
							</div>
							<div className="ml-auto w-full max-w-xs space-y-2 text-sm">
								<MoneyRow
									label="Subtotal"
									cents={selectedInvoice.subtotalCents}
									currency={selectedInvoice.currency}
								/>
								<MoneyRow
									label="Tax"
									cents={selectedInvoice.taxCents}
									currency={selectedInvoice.currency}
								/>
								<MoneyRow
									label="Total"
									cents={selectedInvoice.totalCents}
									currency={selectedInvoice.currency}
									strong
								/>
							</div>
							<DialogFooter>
								{selectedInvoice.totalCents >
								selectedInvoice.amountPaidCents ? (
									<Button
										className="bg-[#7bff5a] text-black hover:bg-[#71ed75]"
										onClick={() => {
											setPayInvoiceId(selectedInvoice.id);
											setSelectedInvoiceId(null);
										}}
									>
										Pay now
									</Button>
								) : null}
								<Button variant="outline" onClick={() => window.print()}>
									Print / save PDF
								</Button>
							</DialogFooter>
						</>
					) : null}
				</DialogContent>
			</Dialog>

			<PaymentDialog
				invoice={payInvoice}
				accounts={data?.paymentAccounts ?? []}
				onClose={() => setPayInvoiceId(null)}
			/>
		</div>
	);
}

function PageHeading({
	eyebrow,
	title,
	description,
	action,
}: {
	eyebrow: string;
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end">
			<div>
				<p className="text-[11px] uppercase tracking-[0.22em] text-[#7bff5a]">
					{eyebrow}
				</p>
				<h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">{title}</h1>
				<p className="mt-2 max-w-2xl text-sm text-white/45">{description}</p>
			</div>
			{action ? <div className="sm:ml-auto">{action}</div> : null}
		</div>
	);
}

function Overview({
	data,
	currency,
	onView,
}: {
	data: PortalData;
	currency: string;
	onView: (view: View) => void;
}) {
	const recentRequests = data.serviceRequests.slice(0, 4);
	return (
		<div>
			<PageHeading
				eyebrow="Client workspace"
				title={`Welcome to ${data.name}`}
				description="A live view of delivery, finances, support and scheduled decisions with your VAYU team."
			/>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Metric
					label="Active projects"
					value={String(data.analytics.activeProjects).padStart(2, "0")}
					detail={`${data.analytics.openTasks} open tasks`}
					tone="coral"
				/>
				<Metric
					label="Delivery progress"
					value={`${data.analytics.deliveryProgress}%`}
					detail={`${data.analytics.completedTasks} tasks completed`}
					tone="mint"
				/>
				<Metric
					label="Outstanding balance"
					value={formatMoney(data.analytics.outstandingCents, currency)}
					detail={`${data.analytics.overdueInvoices} overdue invoices`}
					tone="gradient"
				/>
				<Metric
					label="Open requests"
					value={String(data.analytics.openRequests).padStart(2, "0")}
					detail={`${data.analytics.urgentRequests} urgent`}
					tone="violet"
				/>
			</div>
			<div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
				<section className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
					<SectionTitle
						title="Delivery progress"
						action={
							<button
								type="button"
								className="text-xs text-[#7bff5a]"
								onClick={() => onView("projects")}
							>
								View projects
							</button>
						}
					/>
					<div className="mt-5 space-y-5">
						{data.projects.slice(0, 4).map((project) => (
							<ProjectProgress key={project.id} project={project} />
						))}
						{data.projects.length === 0 ? (
							<Empty text="No projects are visible yet." />
						) : null}
					</div>
				</section>
				<section className="rounded-xl border border-white/10 bg-gradient-to-br from-[#7bff5a] via-[#71ed75] to-[#55d9bd] p-5 text-black">
					<p className="text-xs uppercase tracking-wider opacity-60">
						Billing exposure
					</p>
					<p className="mt-7 text-4xl">
						{formatMoney(data.analytics.outstandingCents, currency)}
					</p>
					<p className="mt-2 text-sm opacity-60">Current outstanding balance</p>
					<div className="mt-10 border-black/15 border-t pt-4">
						<div className="flex justify-between text-sm">
							<span>Paid to date</span>
							<strong>{formatMoney(data.analytics.paidCents, currency)}</strong>
						</div>
						<Button
							className="mt-4 w-full bg-black text-white hover:bg-black/80"
							onClick={() => onView("billing")}
						>
							Open billing center
						</Button>
					</div>
				</section>
			</div>
			<div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
				<section className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
					<SectionTitle
						title="Recent service requests"
						action={
							<button
								type="button"
								className="text-xs text-[#7bff5a]"
								onClick={() => onView("requests")}
							>
								View all
							</button>
						}
					/>
					<div className="mt-4 divide-y divide-white/10">
						{recentRequests.map((request) => (
							<div
								key={request.id}
								className="grid grid-cols-[1fr_auto] gap-3 py-3"
							>
								<div>
									<p className="text-sm">{request.title}</p>
									<p className="mt-1 text-xs text-white/35">
										{request.reference} · {request.project?.name ?? "General"}
									</p>
								</div>
								<StatusBadge value={request.status} />
							</div>
						))}
						{recentRequests.length === 0 ? (
							<Empty text="No service requests yet." />
						) : null}
					</div>
				</section>
				<section className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
					<SectionTitle title="Upcoming meetings" />
					<div className="mt-4 space-y-3">
						{data.calendarEvents.slice(0, 4).map((event) => (
							<div key={event.id} className="flex gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#71ed75]/10 text-[#71ed75]">
									<Calendar />
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm">{event.title ?? "Meeting"}</p>
									<p className="mt-1 text-xs text-white/35">
										{dateTimeLabel(event.startsAt)}
									</p>
								</div>
							</div>
						))}
						{data.calendarEvents.length === 0 ? (
							<Empty text="No upcoming meetings." />
						) : null}
					</div>
				</section>
			</div>
		</div>
	);
}

function Projects({ data }: { data: PortalData }) {
	return (
		<div>
			<PageHeading
				eyebrow="Delivery"
				title="Projects"
				description="Scope, progress, tasks and deadlines across your active work."
			/>
			<div className="grid gap-4 lg:grid-cols-2">
				{data.projects.map((project) => (
					<article
						key={project.id}
						className="rounded-xl border border-white/10 bg-white/[0.025] p-5"
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<h2 className="text-xl">{project.name}</h2>
								<p className="mt-1 text-xs text-white/35">
									{project.dueDate
										? `Due ${dateLabel(project.dueDate)}`
										: "Ongoing"}
								</p>
							</div>
							<StatusBadge value={project.status} />
						</div>
						{project.description ? (
							<p className="mt-4 text-sm leading-relaxed text-white/50">
								{project.description}
							</p>
						) : null}
						<div className="mt-5">
							<ProjectProgress project={project} compact />
						</div>
						<div className="mt-5 space-y-2">
							{project.tasks.map((task) => (
								<div
									key={task.id}
									className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm"
								>
									<span
										className={`size-2 rounded-full ${task.status === "DONE" ? "bg-[#71ed75]" : task.status === "BLOCKED" ? "bg-[#7bff5a]" : "bg-white/25"}`}
									/>
									<span
										className={
											task.status === "DONE"
												? "text-white/30 line-through"
												: "text-white/65"
										}
									>
										{task.title}
									</span>
									<span className="ml-auto text-[10px] uppercase text-white/30">
										{label(task.status)}
									</span>
								</div>
							))}
						</div>
					</article>
				))}
				{data.projects.length === 0 ? (
					<Empty text="No projects are visible yet." />
				) : null}
			</div>
		</div>
	);
}

function Billing({
	data,
	onInvoice,
	onPay,
}: {
	data: PortalData;
	onInvoice: (id: string) => void;
	onPay: (id: string) => void;
}) {
	const currency = data.invoices[0]?.currency ?? "JMD";
	return (
		<div>
			<PageHeading
				eyebrow="Finance"
				title="Billing center"
				description="Review invoice status, amounts paid, balances and line-item detail."
			/>
			<div className="mb-5 grid gap-3 sm:grid-cols-3">
				<Metric
					label="Outstanding"
					value={formatMoney(data.analytics.outstandingCents, currency)}
					detail="Across open invoices"
					tone="gradient"
				/>
				<Metric
					label="Paid to date"
					value={formatMoney(data.analytics.paidCents, currency)}
					detail="Recorded payments"
					tone="mint"
				/>
				<Metric
					label="Overdue"
					value={String(data.analytics.overdueInvoices).padStart(2, "0")}
					detail="Requires attention"
					tone="coral"
				/>
			</div>
			<section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
				<div className="hidden grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-4 border-white/10 border-b px-5 py-3 text-[10px] uppercase tracking-wider text-white/30 md:grid">
					<span>Invoice</span>
					<span>Issued</span>
					<span>Due</span>
					<span>Balance</span>
					<span>Status</span>
					<span>Payment</span>
				</div>
				{data.invoices.map((invoice) => (
					<div
						key={invoice.id}
						className="grid w-full gap-2 border-white/10 border-b px-5 py-4 text-left transition last:border-0 hover:bg-white/[0.04] md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] md:items-center md:gap-4"
					>
						<button
							type="button"
							onClick={() => onInvoice(invoice.id)}
							className="text-left font-medium hover:text-[#7bff5a]"
						>
							{invoice.number}
						</button>
						<span className="text-sm text-white/45">
							{dateLabel(invoice.issueDate)}
						</span>
						<span className="text-sm text-white/45">
							{dateLabel(invoice.dueDate)}
						</span>
						<span className="tabular-nums">
							{formatMoney(
								Math.max(0, invoice.totalCents - invoice.amountPaidCents),
								invoice.currency,
							)}
						</span>
						<StatusBadge value={invoice.status} />
						{invoice.totalCents > invoice.amountPaidCents ? (
							<Button
								size="sm"
								className="bg-[#7bff5a] text-black hover:bg-[#71ed75]"
								onClick={() => onPay(invoice.id)}
							>
								Pay now
							</Button>
						) : (
							<span className="text-xs text-white/35">Settled</span>
						)}
					</div>
				))}
				{data.invoices.length === 0 ? (
					<Empty text="No invoices are visible yet." />
				) : null}
			</section>
		</div>
	);
}

function PaymentDialog({
	invoice,
	accounts,
	onClose,
}: {
	invoice: PortalInvoice | null;
	accounts: PortalData["paymentAccounts"];
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [channel, setChannel] = useState<"DIRECT" | "ONLINE">("DIRECT");
	const [method, setMethod] = useState<
		"CHECK" | "RTGS" | "ACH" | "DIRECT_TRANSFER"
	>("DIRECT_TRANSFER");
	const [currency, setCurrency] = useState<"USD" | "JMD">("USD");
	const [transactionId, setTransactionId] = useState("");
	const [transferredAt, setTransferredAt] = useState("");
	const [senderBank, setSenderBank] = useState("");
	const [senderBranch, setSenderBranch] = useState("");
	const [attachment, setAttachment] = useState<{
		name: string;
		mediaType: "application/pdf" | "image/jpeg" | "image/png";
		size: number;
		base64: string;
	} | null>(null);
	const account = accounts.find((item) => item.currency === currency) ?? null;
	const submit = useMutation(
		trpc.portal.submitInvoicePayment.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.portal.mine.queryKey(),
				});
				toast.success("Payment proof submitted for verification.");
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const metadataComplete = Boolean(
		transactionId.trim() &&
			transferredAt &&
			senderBank.trim() &&
			senderBranch.trim(),
	);
	const canSubmit = Boolean(
		invoice &&
			channel === "DIRECT" &&
			account &&
			(attachment || metadataComplete),
	);

	return (
		<Dialog open={Boolean(invoice)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[92svh] overflow-y-auto border-white/10 bg-[#101410] text-white sm:max-w-2xl">
				{invoice ? (
					<form
						className="space-y-5"
						onSubmit={(event) => {
							event.preventDefault();
							if (!canSubmit) return;
							submit.mutate({
								invoiceId: invoice.id,
								method,
								currency,
								amountCents: Math.max(
									0,
									invoice.totalCents - invoice.amountPaidCents,
								),
								transactionId: transactionId || undefined,
								transferredAt: transferredAt
									? new Date(transferredAt).toISOString()
									: undefined,
								senderBank: senderBank || undefined,
								senderBranch: senderBranch || undefined,
								attachment: attachment ?? undefined,
							});
						}}
					>
						<DialogHeader>
							<p className="text-xs uppercase tracking-[0.2em] text-[#7bff5a]">
								Secure payment notice
							</p>
							<DialogTitle>Pay invoice {invoice.number}</DialogTitle>
							<DialogDescription>
								Submit transfer details for VAYU to verify. This does not mark
								the invoice paid automatically.
							</DialogDescription>
						</DialogHeader>

						<div className="grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								onClick={() => setChannel("DIRECT")}
								className={`rounded-xl border p-4 text-left ${channel === "DIRECT" ? "border-[#7bff5a]/60 bg-[#7bff5a]/10" : "border-white/10 bg-white/[0.025]"}`}
							>
								<p className="font-medium">Direct transfer</p>
								<p className="mt-1 text-xs text-white/45">
									Check, RTGS, ACH or bank transfer
								</p>
							</button>
							<button
								type="button"
								disabled
								className="cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.015] p-4 text-left opacity-45"
							>
								<p className="font-medium">Online payment</p>
								<p className="mt-1 text-xs text-white/45">
									Coming soon — currently disabled
								</p>
							</button>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<label className="grid gap-1.5 text-sm" htmlFor="transfer-method">
								Payment method
								<select
									id="transfer-method"
									value={method}
									onChange={(event) =>
										setMethod(event.target.value as typeof method)
									}
									className="h-10 rounded-md border border-white/10 bg-[#081008] px-3"
								>
									<option value="DIRECT_TRANSFER">Direct bank transfer</option>
									<option value="RTGS">RTGS</option>
									<option value="ACH">ACH</option>
									<option value="CHECK">Check</option>
								</select>
							</label>
							<label
								className="grid gap-1.5 text-sm"
								htmlFor="payment-currency"
							>
								Payment currency
								<select
									id="payment-currency"
									value={currency}
									onChange={(event) =>
										setCurrency(event.target.value as "USD" | "JMD")
									}
									className="h-10 rounded-md border border-white/10 bg-[#081008] px-3"
								>
									<option value="USD">USD</option>
									<option value="JMD">JMD</option>
								</select>
							</label>
						</div>

						{account ? (
							<section className="rounded-xl border border-[#7bff5a]/20 bg-gradient-to-br from-[#7bff5a]/10 to-[#55d9bd]/5 p-4">
								<div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
									<BankDetail label="Bank" value={account.bankName} />
									<BankDetail
										label="Branch"
										value={account.branchName ?? account.bankAddress ?? "—"}
									/>
									<BankDetail
										label="Account name"
										value={account.accountName}
									/>
									<BankDetail
										label="Account number"
										value={account.accountNumber}
									/>
									<BankDetail
										label="Account type"
										value={account.accountType ?? "—"}
									/>
									<BankDetail
										label="SWIFT / BIC"
										value={account.swiftCode ?? "—"}
									/>
									<BankDetail
										label="Branch code"
										value={account.branchCode ?? "—"}
									/>
									<BankDetail label="Currency" value={account.currency} />
								</div>
							</section>
						) : (
							<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
								JMD bank instructions are awaiting setup. Contact VAYU Billing
								or choose USD.
							</div>
						)}

						<div className="grid gap-4 sm:grid-cols-2">
							<label
								className="grid gap-1.5 text-sm"
								htmlFor="payment-transaction-id"
							>
								Transaction ID
								<Input
									id="payment-transaction-id"
									value={transactionId}
									onChange={(event) => setTransactionId(event.target.value)}
								/>
							</label>
							<label
								className="grid gap-1.5 text-sm"
								htmlFor="payment-transfer-time"
							>
								Transfer date and time
								<Input
									id="payment-transfer-time"
									type="datetime-local"
									value={transferredAt}
									onChange={(event) => setTransferredAt(event.target.value)}
								/>
							</label>
							<label
								className="grid gap-1.5 text-sm"
								htmlFor="payment-sender-bank"
							>
								Sender bank
								<Input
									id="payment-sender-bank"
									value={senderBank}
									onChange={(event) => setSenderBank(event.target.value)}
								/>
							</label>
							<label
								className="grid gap-1.5 text-sm"
								htmlFor="payment-sender-branch"
							>
								Sender branch
								<Input
									id="payment-sender-branch"
									value={senderBranch}
									onChange={(event) => setSenderBranch(event.target.value)}
								/>
							</label>
						</div>
						<label className="grid gap-1.5 text-sm" htmlFor="payment-proof">
							Attach invoice or payment proof
							<Input
								id="payment-proof"
								type="file"
								accept="application/pdf,image/jpeg,image/png"
								onChange={async (event) => {
									const file = event.target.files?.[0];
									if (!file) return setAttachment(null);
									if (file.size > 5_000_000)
										return toast.error(
											"Payment proof must be 5 MB or smaller.",
										);
									if (
										!["application/pdf", "image/jpeg", "image/png"].includes(
											file.type,
										)
									)
										return toast.error("Use a PDF, JPG or PNG file.");
									const encoded = await fileToBase64(file);
									setAttachment({
										name: file.name,
										mediaType: file.type as
											| "application/pdf"
											| "image/jpeg"
											| "image/png",
										size: file.size,
										base64: encoded,
									});
								}}
							/>
							<span className="text-xs text-white/35">
								Upload proof, or complete all four transfer-detail fields above.
								Maximum 5 MB.
							</span>
						</label>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={onClose}>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={!canSubmit || submit.isPending}
								className="bg-[#7bff5a] text-black hover:bg-[#71ed75]"
							>
								{submit.isPending ? "Submitting…" : "Submit for verification"}
							</Button>
						</DialogFooter>
					</form>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function BankDetail({
	label: detailLabel,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div>
			<p className="text-[10px] uppercase tracking-wider text-white/35">
				{detailLabel}
			</p>
			<p className="mt-1 font-medium text-white/85">{value}</p>
		</div>
	);
}

async function fileToBase64(file: File) {
	const url = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
	return url.slice(url.indexOf(",") + 1);
}

function Requests({
	data,
	selectedId,
	onSelect,
	onNew,
}: {
	data: PortalData;
	selectedId: string | null;
	onSelect: (id: string) => void;
	onNew: () => void;
}) {
	return (
		<div>
			<PageHeading
				eyebrow="Support desk"
				title="Service requests"
				description="Request help or changes and follow every response in one auditable thread."
				action={
					<Button onClick={onNew}>
						<Add data-icon="inline-start" /> New service request
					</Button>
				}
			/>
			<div className="grid gap-3 sm:grid-cols-3">
				<Metric
					label="Open requests"
					value={String(data.analytics.openRequests).padStart(2, "0")}
					detail="Being tracked"
					tone="coral"
				/>
				<Metric
					label="Urgent"
					value={String(data.analytics.urgentRequests).padStart(2, "0")}
					detail="Highest priority"
					tone="violet"
				/>
				<Metric
					label="Resolved"
					value={String(data.analytics.resolvedRequests).padStart(2, "0")}
					detail="Completed requests"
					tone="mint"
				/>
			</div>
			<section className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
				<div className="hidden grid-cols-[.8fr_1.7fr_1fr_.7fr_.8fr] gap-4 border-white/10 border-b px-5 py-3 text-[10px] uppercase tracking-wider text-white/30 md:grid">
					<span>ID</span>
					<span>Subject</span>
					<span>Project</span>
					<span>Priority</span>
					<span>Status</span>
				</div>
				{data.serviceRequests.map((request) => (
					<button
						key={request.id}
						type="button"
						onClick={() => onSelect(request.id)}
						className={`grid w-full gap-2 border-white/10 border-b px-5 py-4 text-left transition last:border-0 hover:bg-white/[0.04] md:grid-cols-[.8fr_1.7fr_1fr_.7fr_.8fr] md:items-center md:gap-4 ${selectedId === request.id ? "bg-white/[0.05]" : ""}`}
					>
						<span className="text-xs text-[#7bff5a]">{request.reference}</span>
						<span className="text-sm">{request.title}</span>
						<span className="truncate text-sm text-white/40">
							{request.project?.name ?? "General"}
						</span>
						<StatusBadge value={request.priority} />
						<StatusBadge value={request.status} />
					</button>
				))}
				{data.serviceRequests.length === 0 ? (
					<Empty text="No service requests yet. Create one when you need help or a change." />
				) : null}
			</section>
		</div>
	);
}

function Meetings({ data }: { data: PortalData }) {
	return (
		<div>
			<PageHeading
				eyebrow="Meetings"
				title="Calendar & summaries"
				description="Upcoming appointments and client-visible Fireflies notes, decisions and actions."
			/>
			<div className="grid gap-5 xl:grid-cols-2">
				<section>
					<SectionTitle title="Upcoming" />
					<div className="mt-4 space-y-3">
						{data.calendarEvents.map((event) => (
							<article
								key={event.id}
								className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4"
							>
								<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#71ed75]/10 text-[#71ed75]">
									<Calendar />
								</div>
								<div className="min-w-0">
									<p className="truncate">{event.title ?? "Meeting"}</p>
									<p className="mt-1 text-xs text-white/35">
										{dateTimeLabel(event.startsAt)}
										{event.location ? ` · ${event.location}` : ""}
									</p>
								</div>
								{event.conferenceUrl ? (
									<a
										href={event.conferenceUrl}
										target="_blank"
										rel="noreferrer"
										className="ml-auto inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black"
									>
										<Video /> Join
									</a>
								) : null}
							</article>
						))}
						{data.calendarEvents.length === 0 ? (
							<Empty text="No upcoming meetings." />
						) : null}
					</div>
				</section>
				<section>
					<SectionTitle title="Meeting summaries" />
					<div className="mt-4 space-y-3">
						{data.meetingSummaries.map((meeting) => (
							<article
								key={meeting.id}
								className="rounded-xl border border-white/10 bg-white/[0.025] p-5"
							>
								<div className="flex gap-3">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#7bff5a] to-[#55d9bd]">
										<Document />
									</div>
									<div>
										<h3>{meeting.title}</h3>
										<p className="mt-1 text-xs text-white/35">
											{dateTimeLabel(meeting.meetingAt)}
											{meeting.project ? ` · ${meeting.project.name}` : ""}
										</p>
									</div>
								</div>
								<p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/60">
									{meeting.summary}
								</p>
								{meeting.transcriptUrl ? (
									<a
										className="mt-4 inline-flex text-xs text-[#7bff5a]"
										href={meeting.transcriptUrl}
										target="_blank"
										rel="noreferrer"
									>
										Open meeting record
									</a>
								) : null}
							</article>
						))}
						{data.meetingSummaries.length === 0 ? (
							<Empty text="Fireflies summaries will appear here after meetings." />
						) : null}
					</div>
				</section>
			</div>
		</div>
	);
}

function Assistant({
	data,
	conversation,
	value,
	onChange,
	pending,
	onSend,
}: {
	data: PortalData;
	conversation: PortalConversation | null;
	value: string;
	onChange: (value: string) => void;
	pending: boolean;
	onSend: () => void;
}) {
	const messages = conversation?.messages ?? [];
	return (
		<div className="mx-auto max-w-4xl">
			<PageHeading
				eyebrow="VAYU intelligence"
				title="Client AI Assistant"
				description="Ask GPT-5.5 about your projects, invoices, meetings and service requests. Answers are scoped to your authenticated client account."
			/>
			<section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
				<div className="flex items-center gap-3 border-white/10 border-b p-4">
					<div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#71ed75] to-[#55d9bd]">
						<VayuMark className="size-7" />
					</div>
					<div>
						<p className="font-medium">VAYU Assistant</p>
						<p className="flex items-center gap-2 text-xs text-white/40">
							<span
								className={`size-2 rounded-full ${data.ai.configured ? "bg-[#71ed75]" : "bg-[#7bff5a]"}`}
							/>
							{data.ai.configured
								? "GPT-5.5 connected"
								: "OpenAI authorization required"}
						</p>
					</div>
				</div>
				<div className="min-h-[420px] space-y-4 p-5">
					{messages.length === 0 ? (
						<div className="mx-auto max-w-md py-16 text-center">
							<div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#7bff5a]/10 text-[#7bff5a]">
								<Chat />
							</div>
							<h2 className="mt-4 text-lg">What can I help you understand?</h2>
							<p className="mt-2 text-sm text-white/40">
								Try “Which tasks are overdue?”, “Explain my outstanding
								invoices”, or “Summarize our latest meeting.”
							</p>
						</div>
					) : (
						messages.map((message) => (
							<div
								key={message.id}
								className={`flex ${message.role === "VISITOR" ? "justify-end" : "justify-start"}`}
							>
								<div
									className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "VISITOR" ? "bg-[#7bff5a] text-black" : "border border-white/10 bg-white/[0.05] text-white/70"}`}
								>
									{message.content}
								</div>
							</div>
						))
					)}
					{pending ? (
						<p className="text-xs text-white/35">
							GPT-5.5 is reviewing your client workspace…
						</p>
					) : null}
				</div>
				<form
					className="flex gap-2 border-white/10 border-t p-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (value.trim()) onSend();
					}}
				>
					<Input
						value={value}
						onChange={(event) => onChange(event.target.value)}
						placeholder={
							data.ai.configured
								? "Ask about your account…"
								: "OpenAI API authorization is required"
						}
						disabled={!data.ai.configured || pending}
					/>
					<Button
						type="submit"
						disabled={!data.ai.configured || !value.trim() || pending}
					>
						<Send />
					</Button>
				</form>
			</section>
		</div>
	);
}

function Metric({
	label: metricLabel,
	value,
	detail,
	tone,
}: {
	label: string;
	value: string;
	detail: string;
	tone: "coral" | "mint" | "gradient" | "violet";
}) {
	const colors = {
		coral: "from-[#7bff5a]/15 to-transparent text-[#ff6b6b]",
		mint: "from-[#71ed75]/15 to-transparent text-[#71ed75]",
		gradient: "from-[#7bff5a]/15 to-[#55d9bd]/10 text-[#b7ffc5]",
		violet: "from-[#55d9bd]/15 to-transparent text-[#8eead2]",
	};
	return (
		<div
			className={`rounded-xl border border-white/10 bg-gradient-to-br p-4 ${colors[tone]}`}
		>
			<p className="text-[10px] uppercase tracking-wider text-white/38">
				{metricLabel}
			</p>
			<p className="mt-4 text-3xl tracking-tight text-white tabular-nums">
				{value}
			</p>
			<p className="mt-2 text-xs text-white/35">{detail}</p>
		</div>
	);
}
function SectionTitle({
	title,
	action,
}: {
	title: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<h2 className="text-lg">{title}</h2>
			{action}
		</div>
	);
}
function ProjectProgress({
	project,
	compact = false,
}: {
	project: PortalProject;
	compact?: boolean;
}) {
	const done = project.tasks.filter((task) => task.status === "DONE").length;
	const progress = project.tasks.length
		? Math.round((done / project.tasks.length) * 100)
		: 0;
	return (
		<div>
			<div className="mb-2 flex justify-between gap-3 text-xs">
				<span className={compact ? "text-white/45" : "text-white/70"}>
					{project.name}
				</span>
				<span className="text-white/35">{progress}%</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-white/10">
				<div
					className="h-full rounded-full bg-gradient-to-r from-[#7bff5a] to-[#71ed75]"
					style={{ width: `${progress}%` }}
				/>
			</div>
			<p className="mt-2 text-[11px] text-white/30">
				{done} of {project.tasks.length} tasks complete
			</p>
		</div>
	);
}
function StatusBadge({ value }: { value: string }) {
	const normalized = value.toUpperCase();
	const color = ["PAID", "DONE", "COMPLETED", "RESOLVED", "ACTIVE"].includes(
		normalized,
	)
		? "border-[#71ed75]/25 bg-[#71ed75]/10 text-[#8effa0]"
		: ["URGENT", "HIGH", "OVERDUE", "BLOCKED"].includes(normalized)
			? "border-[#7bff5a]/30 bg-[#7bff5a]/10 text-[#ff6b6b]"
			: "border-white/10 bg-white/[0.04] text-white/55";
	return (
		<span
			className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${color}`}
		>
			{label(value)}
		</span>
	);
}
function MoneyRow({
	label: rowLabel,
	cents,
	currency,
	strong,
}: {
	label: string;
	cents: number;
	currency: string;
	strong?: boolean;
}) {
	return (
		<div
			className={`flex justify-between ${strong ? "border-white/10 border-t pt-2 font-medium" : "text-white/55"}`}
		>
			<span>{rowLabel}</span>
			<span>{formatMoney(cents, currency)}</span>
		</div>
	);
}
function Empty({ text }: { text: string }) {
	return (
		<div className="rounded-lg border border-white/10 border-dashed p-5 text-sm text-white/35">
			{text}
		</div>
	);
}
function AccessError() {
	return (
		<div className="rounded-xl border border-[#7bff5a]/30 bg-[#7bff5a]/10 p-6">
			<h1 className="text-xl">Portal access is not active</h1>
			<p className="mt-2 text-sm text-white/55">
				Ask your VAYU account manager to enable this email address.
			</p>
		</div>
	);
}
function PortalSkeleton() {
	return (
		<div className="space-y-5">
			<Skeleton className="h-12 w-80" />
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
			</div>
			<Skeleton className="h-96" />
		</div>
	);
}
function label(value: string) {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}
function dateLabel(value: string | Date) {
	return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
		new Date(value),
	);
}
function dateTimeLabel(value: string | Date) {
	return new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
