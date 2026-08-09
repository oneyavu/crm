"use client";

import Chat from "@carbon/icons-react/es/Chat";
import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import Copy from "@carbon/icons-react/es/Copy";
import Headphones from "@carbon/icons-react/es/Headphones";
import Send from "@carbon/icons-react/es/Send";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Skeleton } from "@crm/ui/components/skeleton";
import { Switch } from "@crm/ui/components/switch";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { VayuMark } from "@/components/vayu-brand";
import { useTRPC } from "@/lib/trpc/client";

type Draft = {
	name: string;
	welcomeMessage: string;
	accentColor: string;
	position: "BOTTOM_LEFT" | "BOTTOM_RIGHT";
	aiEnabled: boolean;
	liveSupportEnabled: boolean;
	requireEmail: boolean;
	allowedDomains: string;
	quickActions: string;
	knowledgeText: string;
	active: boolean;
};

export function WidgetStudio() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const widget = useQuery(trpc.support.widget.queryOptions());
	const inbox = useQuery(
		trpc.support.conversations.queryOptions(undefined, {
			refetchInterval: 10_000,
		}),
	);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reply, setReply] = useState("");

	useEffect(() => {
		if (!widget.data || draft) return;
		setDraft({
			name: widget.data.name,
			welcomeMessage: widget.data.welcomeMessage,
			accentColor: widget.data.accentColor,
			position: widget.data.position,
			aiEnabled: widget.data.aiEnabled,
			liveSupportEnabled: widget.data.liveSupportEnabled,
			requireEmail: widget.data.requireEmail,
			allowedDomains: widget.data.allowedDomains.join(", "),
			quickActions: widget.data.quickActions.join("\n"),
			knowledgeText: widget.data.knowledgeText ?? "",
			active: widget.data.active,
		});
	}, [widget.data, draft]);

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.support.widget.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.support.conversations.queryKey(),
			}),
		]);
	const save = useMutation(
		trpc.support.saveWidget.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Widget settings saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const updateConversation = useMutation(
		trpc.support.updateConversation.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const sendReply = useMutation(
		trpc.support.reply.mutationOptions({
			onSuccess: async () => {
				setReply("");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const createServiceRequest = useMutation(
		trpc.support.createServiceRequest.mutationOptions({
			onSuccess: async (result) => {
				await refresh();
				toast.success(
					result.created
						? `${result.reference} created and submitted.`
						: `${result.reference} is already linked.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const conversations = inbox.data ?? [];
	const selected =
		conversations.find((conversation) => conversation.id === selectedId) ??
		conversations[0] ??
		null;
	const waiting = conversations.filter(
		(conversation) => conversation.status === "WAITING_FOR_AGENT",
	).length;
	const live = conversations.filter(
		(conversation) => conversation.status === "LIVE_AGENT",
	).length;
	const ai = conversations.filter(
		(conversation) => conversation.status === "AI_ACTIVE",
	).length;
	const embedCode = widget.data?.publicKey
		? `<script async src="https://asina.onevayu.com/widget.js" data-vayu-widget="${widget.data.publicKey}" data-position="left" data-vapi-public-key="2ecd9a64-72b1-408e-a895-ff2b19655746" data-vapi-assistant-id="36382f71-3794-4f84-a957-3dd8248154ee"></script>`
		: "Save the widget once to generate embed code.";

	if (widget.isLoading || !draft)
		return (
			<div className="grid gap-4 lg:grid-cols-3">
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
		);

	const submit = (active: boolean) =>
		save.mutate({
			name: draft.name,
			welcomeMessage: draft.welcomeMessage,
			accentColor: draft.accentColor,
			position: draft.position,
			aiEnabled: draft.aiEnabled,
			liveSupportEnabled: draft.liveSupportEnabled,
			requireEmail: draft.requireEmail,
			allowedDomains: draft.allowedDomains
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
			quickActions: draft.quickActions
				.split("\n")
				.map((item) => item.trim())
				.filter(Boolean),
			knowledgeText: draft.knowledgeText,
			active,
		});

	return (
		<div className="space-y-5">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<StudioMetric
					icon={<VayuMark className="size-6" />}
					label="GPT-5.5"
					value="Direct OpenAI"
					good
				/>
				<StudioMetric
					icon={<Headphones />}
					label="Vapi voice"
					value="Talk With Us"
					good
				/>
				<StudioMetric
					icon={<Headphones />}
					label="Live support"
					value={waiting ? `${waiting} waiting` : "Online"}
					good={!waiting}
				/>
				<StudioMetric
					icon={<Chat />}
					label="Conversations"
					value={String(conversations.length)}
				/>
				<StudioMetric
					icon={<CheckmarkFilled />}
					label="AI handled"
					value={String(ai)}
					good
				/>
			</div>

			<div className="grid gap-4 xl:grid-cols-[.8fr_1.25fr_.85fr]">
				<section className="rounded-xl border bg-card p-4">
					<h2 className="font-medium">Widget configuration</h2>
					<div className="mt-4 space-y-4">
						<Field label="Widget name">
							<Input
								value={draft.name}
								onChange={(event) =>
									setDraft({ ...draft, name: event.target.value })
								}
							/>
						</Field>
						<Field label="Welcome message">
							<Textarea
								rows={3}
								value={draft.welcomeMessage}
								onChange={(event) =>
									setDraft({ ...draft, welcomeMessage: event.target.value })
								}
							/>
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Brand color">
								<Input
									type="color"
									className="w-full p-1"
									value={draft.accentColor}
									onChange={(event) =>
										setDraft({ ...draft, accentColor: event.target.value })
									}
								/>
							</Field>
							<Field label="Position">
								<select
									className="h-9 w-full rounded-md border bg-background px-3 text-sm"
									value={draft.position}
									onChange={(event) =>
										setDraft({
											...draft,
											position: event.target.value as Draft["position"],
										})
									}
								>
									<option value="BOTTOM_RIGHT">Bottom right</option>
									<option value="BOTTOM_LEFT">Bottom left</option>
								</select>
							</Field>
						</div>
						<Toggle
							label="AI assistant (GPT-5.5)"
							checked={draft.aiEnabled}
							onChange={(value) => setDraft({ ...draft, aiEnabled: value })}
						/>
						<Toggle
							label="Live-agent handoff"
							checked={draft.liveSupportEnabled}
							onChange={(value) =>
								setDraft({ ...draft, liveSupportEnabled: value })
							}
						/>
						<Toggle
							label="Collect visitor email"
							checked={draft.requireEmail}
							onChange={(value) => setDraft({ ...draft, requireEmail: value })}
						/>
						<Field label="Quick actions (one per line)">
							<Textarea
								rows={4}
								value={draft.quickActions}
								onChange={(event) =>
									setDraft({ ...draft, quickActions: event.target.value })
								}
							/>
						</Field>
						<Field label="Knowledge for GPT-5.5">
							<Textarea
								rows={6}
								value={draft.knowledgeText}
								onChange={(event) =>
									setDraft({ ...draft, knowledgeText: event.target.value })
								}
								placeholder="Approved services, policies, opening hours and routing instructions…"
							/>
						</Field>
					</div>
				</section>

				<section className="overflow-hidden rounded-xl border bg-[#0d0e0e]">
					<div className="border-white/10 border-b px-4 py-3 text-xs text-white/40">
						Preview · onevayu.com
					</div>
					<div className="relative min-h-[610px] overflow-hidden bg-[radial-gradient(circle_at_70%_45%,rgba(149,126,177,.28),transparent_36%),linear-gradient(145deg,#151616,#0b0c0c)] p-8 text-white">
						<p className="text-xl font-semibold text-[#7bff5a]">VAYU</p>
						<p className="mt-24 max-w-sm text-5xl leading-[1.05] tracking-tight">
							Technology that moves business forward.
						</p>
						<p className="mt-5 max-w-xs text-sm text-white/50">
							AI-powered solutions and managed services for modern enterprises.
						</p>
						<div
							className={`absolute bottom-5 w-[340px] max-w-[calc(100%-2rem)] ${draft.position === "BOTTOM_LEFT" ? "left-5" : "right-5"}`}
						>
							<WidgetPreview draft={draft} />
						</div>
					</div>
				</section>

				<section className="rounded-xl border bg-card p-4">
					<h2 className="font-medium">Publish & install</h2>
					<div className="mt-4 space-y-4">
						<Field label="Allowed domains">
							<Input
								value={draft.allowedDomains}
								onChange={(event) =>
									setDraft({ ...draft, allowedDomains: event.target.value })
								}
								placeholder="onevayu.com, www.onevayu.com"
							/>
						</Field>
						<Field label="Embed code">
							<Textarea
								readOnly
								rows={8}
								className="font-mono text-xs"
								value={embedCode}
							/>
						</Field>
						<Button
							variant="outline"
							className="w-full"
							onClick={() =>
								navigator.clipboard
									.writeText(embedCode)
									.then(() => toast.success("Embed code copied."))
							}
						>
							<Copy data-icon="inline-start" /> Copy code
						</Button>
						<div className="rounded-lg border p-3">
							<div className="flex items-center justify-between">
								<span className="text-sm">Installation status</span>
								<Badge>{widget.data?.active ? "Active" : "Draft"}</Badge>
							</div>
							<p className="mt-2 break-all text-xs text-muted-foreground">
								{widget.data?.publicKey ?? "Public key generated on save"}
							</p>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<Button
								variant="outline"
								onClick={() => submit(false)}
								disabled={save.isPending}
							>
								Save draft
							</Button>
							<Button onClick={() => submit(true)} disabled={save.isPending}>
								Publish widget
							</Button>
						</div>
					</div>
				</section>
			</div>

			<section className="overflow-hidden rounded-xl border bg-card">
				<div className="flex items-center gap-3 border-b p-4">
					<h2 className="font-medium">Live support inbox</h2>
					<span className="text-xs text-muted-foreground">
						{waiting} waiting · {live} live · {ai} with AI
					</span>
				</div>
				<div className="grid min-h-[360px] lg:grid-cols-[.8fr_1.2fr]">
					<div className="border-r">
						{conversations.map((conversation) => (
							<button
								key={conversation.id}
								type="button"
								onClick={() => setSelectedId(conversation.id)}
								className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b p-4 text-left hover:bg-muted/40 ${selected?.id === conversation.id ? "bg-muted/60" : ""}`}
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">
										{conversation.visitorName ||
											conversation.visitorEmail ||
											"Website visitor"}
									</p>
									<p className="mt-1 truncate text-xs text-muted-foreground">
										{conversation.messages.at(-1)?.content ??
											"New conversation"}
									</p>
								</div>
								<Badge>{conversation.status.replaceAll("_", " ")}</Badge>
							</button>
						))}
						{conversations.length === 0 ? (
							<p className="p-6 text-sm text-muted-foreground">
								Published widget conversations will appear here.
							</p>
						) : null}
					</div>
					<div className="flex min-h-[360px] flex-col">
						{selected ? (
							<>
								<div className="flex items-center gap-3 border-b p-4">
									<div>
										<p className="text-sm font-medium">
											{selected.visitorName ||
												selected.visitorEmail ||
												"Website visitor"}
										</p>
										<p className="text-xs text-muted-foreground">
											{selected.source.toLowerCase()} ·{" "}
											{selected.status.replaceAll("_", " ").toLowerCase()}
										</p>
									</div>
									<div className="ml-auto flex gap-2">
										{selected.source === "PORTAL" &&
										!selected.subject?.startsWith("SERVICE_REQUEST:") ? (
											<Button
												size="sm"
												onClick={() =>
													createServiceRequest.mutate({ id: selected.id })
												}
												disabled={createServiceRequest.isPending}
											>
												Create service request
											</Button>
										) : null}
										{selected.status !== "LIVE_AGENT" ? (
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													updateConversation.mutate({
														id: selected.id,
														status: "LIVE_AGENT",
													})
												}
											>
												Take over
											</Button>
										) : null}
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												updateConversation.mutate({
													id: selected.id,
													status: "AI_ACTIVE",
												})
											}
										>
											Return to AI
										</Button>
									</div>
								</div>
								<div className="flex-1 space-y-3 overflow-y-auto p-4">
									{selected.messages.map((message) => (
										<div
											key={message.id}
											className={`flex ${message.role === "VISITOR" ? "justify-end" : "justify-start"}`}
										>
											<div
												className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${message.role === "VISITOR" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
											>
												{message.content}
											</div>
										</div>
									))}
								</div>
								<form
									className="flex gap-2 border-t p-4"
									onSubmit={(event) => {
										event.preventDefault();
										if (reply.trim())
											sendReply.mutate({ id: selected.id, message: reply });
									}}
								>
									<Input
										value={reply}
										onChange={(event) => setReply(event.target.value)}
										placeholder="Reply as live support…"
									/>
									<Button
										type="submit"
										disabled={!reply.trim() || sendReply.isPending}
									>
										<Send />
									</Button>
								</form>
							</>
						) : (
							<div className="m-auto text-sm text-muted-foreground">
								Select a conversation.
							</div>
						)}
					</div>
				</div>
			</section>
		</div>
	);
}

function StudioMetric({
	icon,
	label,
	value,
	good,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	good?: boolean;
}) {
	return (
		<div className="flex items-center gap-3 rounded-xl border bg-card p-4">
			<div
				className={`flex size-10 items-center justify-center rounded-xl ${good ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"}`}
			>
				{icon}
			</div>
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="mt-1 text-sm font-medium">{value}</p>
			</div>
		</div>
	);
}
function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid gap-1.5 text-xs text-muted-foreground">
			<span>{label}</span>
			{children}
		</div>
	);
}
function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border p-3 text-sm">
			<span>{label}</span>
			<Switch checked={checked} onCheckedChange={onChange} />
		</div>
	);
}
function WidgetPreview({ draft }: { draft: Draft }) {
	const actions = draft.quickActions.split("\n").filter(Boolean).slice(0, 3);
	return (
		<div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121313] shadow-2xl">
			<div className="flex items-center gap-3 border-white/10 border-b p-4">
				<div
					className="flex size-9 items-center justify-center rounded-xl"
					style={{ backgroundColor: draft.accentColor }}
				>
					<VayuMark className="size-6" />
				</div>
				<div>
					<p className="text-sm font-medium">{draft.name}</p>
					<p className="text-[10px] text-white/40">
						GPT-5.5 · Live support available
					</p>
				</div>
			</div>
			<div className="space-y-3 p-4">
				<div className="max-w-[85%] rounded-xl bg-white/[0.07] p-3 text-xs text-white/70">
					{draft.welcomeMessage}
				</div>
				<div
					className="ml-auto max-w-[80%] rounded-xl p-3 text-xs text-black"
					style={{ backgroundColor: draft.accentColor }}
				>
					Can you help me request a service?
				</div>
				<div className="max-w-[85%] rounded-xl bg-white/[0.07] p-3 text-xs text-white/70">
					Of course. I can help with that or connect you to the VAYU team.
				</div>
				<div className="flex flex-wrap gap-1.5">
					{actions.map((action) => (
						<span
							key={action}
							className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/55"
						>
							{action}
						</span>
					))}
				</div>
				<div className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/30">
					Type your message…
					<Send className="ml-auto" />
				</div>
			</div>
		</div>
	);
}
