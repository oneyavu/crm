"use client";

import Calendar from "@carbon/icons-react/es/Calendar";
import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import Document from "@carbon/icons-react/es/Document";
import Logout from "@carbon/icons-react/es/Logout";
import Task from "@carbon/icons-react/es/Task";
import Video from "@carbon/icons-react/es/Video";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Skeleton } from "@crm/ui/components/skeleton";
import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { VayuMark } from "@/components/vayu-brand";
import { signOutAndRedirect } from "@/lib/sign-out";
import { useTRPC } from "@/lib/trpc/client";

export function ClientPortal({ userName }: { userName: string }) {
	const trpc = useTRPC();
	const portal = useQuery(trpc.portal.mine.queryOptions());
	const data = portal.data;

	return (
		<div className="min-h-svh bg-[#111] text-white">
			<header className="border-white/10 border-b px-5 py-4 sm:px-8">
				<div className="mx-auto flex max-w-7xl items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-md bg-white text-black">
						<VayuMark className="size-7" />
					</div>
					<div>
						<p className="font-semibold">VAYU Client Control</p>
						<p className="text-white/50 text-xs">
							Projects, invoices and meeting updates
						</p>
					</div>
					<div className="ml-auto flex items-center gap-3">
						<span className="hidden text-white/60 text-sm sm:block">
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

			<main className="mx-auto max-w-7xl space-y-10 px-5 py-8 sm:px-8 sm:py-12">
				{portal.isLoading ? <PortalSkeleton /> : null}
				{portal.isError ? (
					<div className="rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 p-6">
						<h1 className="font-semibold text-xl">
							Portal access is not active
						</h1>
						<p className="mt-2 text-white/60 text-sm">
							Ask your VAYU account manager to enable this email address for
							your client portal.
						</p>
					</div>
				) : null}
				{data ? (
					<>
						<section>
							<p className="text-[#ff8a7f] text-xs uppercase tracking-[0.2em]">
								Client workspace
							</p>
							<h1 className="mt-3 max-w-3xl font-medium text-4xl tracking-tight sm:text-5xl">
								{data.name}
							</h1>
							<p className="mt-3 max-w-2xl text-white/55">
								A live view of delivery, finances, scheduled meetings, and
								decisions from your VAYU team.
							</p>
						</section>

						<section className="grid gap-4 md:grid-cols-3">
							<Metric
								label="Active projects"
								value={
									data.projects.filter((project) => project.status === "ACTIVE")
										.length
								}
								icon={<Task />}
							/>
							<Metric
								label="Open tasks"
								value={
									data.projects
										.flatMap((project) => project.tasks)
										.filter((task) => task.status !== "DONE").length
								}
								icon={<CheckmarkFilled />}
							/>
							<Metric
								label="Upcoming meetings"
								value={data.calendarEvents.length}
								icon={<Calendar />}
							/>
						</section>

						<PortalSection
							title="Projects & tasks"
							description="Current scope, delivery status and next actions."
						>
							<div className="grid gap-4 lg:grid-cols-2">
								{data.projects.map((project) => (
									<ProjectCard key={project.id} project={project} />
								))}
								{data.projects.length === 0 ? (
									<Empty text="No projects are visible yet." />
								) : null}
							</div>
						</PortalSection>

						<div className="grid gap-10 xl:grid-cols-2">
							<PortalSection
								title="Invoices"
								description="Issued amounts and payment status."
							>
								<div className="space-y-2">
									{data.invoices.map((invoice) => (
										<div
											key={invoice.id}
											className="grid grid-cols-[1fr_auto] gap-4 rounded-md border border-white/10 bg-white/[0.035] p-4"
										>
											<div>
												<p className="font-medium">{invoice.number}</p>
												<p className="mt-1 text-white/45 text-xs">
													Due {dateLabel(invoice.dueDate)}
												</p>
											</div>
											<div className="text-right">
												<p className="font-medium tabular-nums">
													{formatMoney(invoice.totalCents, invoice.currency)}
												</p>
												<Badge className="mt-2">{invoice.status}</Badge>
											</div>
										</div>
									))}
									{data.invoices.length === 0 ? (
										<Empty text="No invoices are visible yet." />
									) : null}
								</div>
							</PortalSection>

							<PortalSection
								title="Upcoming meetings"
								description="Calendar events routed to your account."
							>
								<div className="space-y-2">
									{data.calendarEvents.map((event) => (
										<div
											key={event.id}
											className="flex items-center gap-4 rounded-md border border-white/10 bg-white/[0.035] p-4"
										>
											<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#6ef2a5]/10 text-[#6ef2a5]">
												<Calendar />
											</div>
											<div className="min-w-0">
												<p className="truncate font-medium">
													{event.title ?? "Meeting"}
												</p>
												<p className="mt-1 text-white/45 text-xs">
													{dateTimeLabel(event.startsAt)}
												</p>
											</div>
											{event.conferenceUrl ? (
												<a
													href={event.conferenceUrl}
													target="_blank"
													rel="noreferrer"
													className="ml-auto inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 font-medium text-black text-xs"
												>
													<Video /> Join
												</a>
											) : null}
										</div>
									))}
									{data.calendarEvents.length === 0 ? (
										<Empty text="No upcoming meetings are scheduled." />
									) : null}
								</div>
							</PortalSection>
						</div>

						<PortalSection
							title="Meeting summaries"
							description="Fireflies notes and actions automatically matched to your account."
						>
							<div className="grid gap-4 lg:grid-cols-2">
								{data.meetingSummaries.map((meeting) => (
									<article
										key={meeting.id}
										className="rounded-md border border-white/10 bg-white/[0.035] p-5"
									>
										<div className="flex items-start gap-4">
											<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#f6a18d] to-[#8d8ad1]">
												<Document />
											</div>
											<div>
												<h3 className="font-medium text-lg">{meeting.title}</h3>
												<p className="mt-1 text-white/45 text-xs">
													{dateTimeLabel(meeting.meetingAt)}
													{meeting.project ? ` · ${meeting.project.name}` : ""}
												</p>
											</div>
										</div>
										<p className="mt-5 whitespace-pre-line text-white/70 text-sm leading-relaxed">
											{meeting.summary}
										</p>
										{meeting.keywords.length > 0 ? (
											<div className="mt-4 flex flex-wrap gap-2">
												{meeting.keywords.slice(0, 8).map((keyword) => (
													<span
														key={keyword}
														className="rounded-full border border-white/10 px-2.5 py-1 text-white/50 text-xs"
													>
														{keyword}
													</span>
												))}
											</div>
										) : null}
										{meeting.transcriptUrl ? (
											<a
												href={meeting.transcriptUrl}
												target="_blank"
												rel="noreferrer"
												className="mt-5 inline-flex text-[#ff8a7f] text-sm hover:text-white"
											>
												Open meeting record
											</a>
										) : null}
									</article>
								))}
								{data.meetingSummaries.length === 0 ? (
									<Empty text="Meeting summaries will appear here after Fireflies completes them." />
								) : null}
							</div>
						</PortalSection>
					</>
				) : null}
			</main>
		</div>
	);
}

function Metric({
	label,
	value,
	icon,
}: {
	label: string;
	value: number;
	icon: React.ReactNode;
}) {
	return (
		<div className="rounded-md border border-white/10 bg-white/[0.035] p-5">
			<div className="flex items-center justify-between text-white/45">
				<span className="text-xs uppercase tracking-wider">{label}</span>
				{icon}
			</div>
			<p className="mt-5 font-light text-4xl tabular-nums">{value}</p>
		</div>
	);
}

function PortalSection({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section>
			<div className="mb-4">
				<h2 className="font-medium text-2xl tracking-tight">{title}</h2>
				<p className="mt-1 text-white/45 text-sm">{description}</p>
			</div>
			{children}
		</section>
	);
}

function ProjectCard({
	project,
}: {
	project: {
		id: string;
		name: string;
		description: string | null;
		status: string;
		dueDate: string | Date | null;
		tasks: Array<{
			id: string;
			title: string;
			status: string;
			priority: string;
			dueDate: string | Date | null;
		}>;
	};
}) {
	const completed = project.tasks.filter(
		(task) => task.status === "DONE",
	).length;
	const progress = project.tasks.length
		? Math.round((completed / project.tasks.length) * 100)
		: 0;
	return (
		<article className="rounded-md border border-white/10 bg-white/[0.035] p-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-medium text-xl">{project.name}</h3>
					<p className="mt-1 text-white/45 text-xs">
						{project.dueDate ? `Due ${dateLabel(project.dueDate)}` : "Ongoing"}
					</p>
				</div>
				<Badge>{project.status}</Badge>
			</div>
			{project.description ? (
				<p className="mt-4 line-clamp-2 text-white/60 text-sm">
					{project.description}
				</p>
			) : null}
			<div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
				<div
					className="h-full rounded-full bg-[#6ef2a5]"
					style={{ width: `${progress}%` }}
				/>
			</div>
			<div className="mt-2 flex justify-between text-white/45 text-xs">
				<span>
					{completed} of {project.tasks.length} tasks complete
				</span>
				<span>{progress}%</span>
			</div>
			<div className="mt-5 space-y-2">
				{project.tasks.slice(0, 6).map((task) => (
					<div key={task.id} className="flex items-center gap-3 text-sm">
						<span
							className={`size-2 rounded-full ${task.status === "DONE" ? "bg-[#6ef2a5]" : task.status === "BLOCKED" ? "bg-[#ff6b6b]" : "bg-white/25"}`}
						/>
						<span
							className={
								task.status === "DONE"
									? "text-white/35 line-through"
									: "text-white/70"
							}
						>
							{task.title}
						</span>
						<span className="ml-auto text-white/35 text-xs">
							{task.status.replaceAll("_", " ")}
						</span>
					</div>
				))}
			</div>
		</article>
	);
}

function Empty({ text }: { text: string }) {
	return (
		<div className="rounded-md border border-white/10 border-dashed p-6 text-white/40 text-sm">
			{text}
		</div>
	);
}

function PortalSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-12 w-80" />
			<div className="grid gap-4 md:grid-cols-3">
				<Skeleton className="h-32" />
				<Skeleton className="h-32" />
				<Skeleton className="h-32" />
			</div>
			<Skeleton className="h-80" />
		</div>
	);
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
