"use client";

import Add from "@carbon/icons-react/es/Add";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { CardContent } from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney, toDay } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function InvoicesWorkspace() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [open, setOpen] = useState(false);
	const [assistantOpen, setAssistantOpen] = useState(false);
	const [companyId, setCompanyId] = useState("");
	const [recipientEmail, setRecipientEmail] = useState("");
	const [catalogItemId, setCatalogItemId] = useState("");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [dueTime, setDueTime] = useState("17:00");
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const canManageInvoices = Boolean(
		workspace.data?.permissions.manageWorkspace,
	);
	const invoices = useQuery(
		trpc.invoices.list.queryOptions({
			q: "",
			page: 1,
			pageSize: 100,
			sort: "dueDate",
			dir: "desc",
			status: "all",
		}),
	);
	const companies = useQuery(trpc.companies.options.queryOptions({ q: "" }));
	const catalog = useQuery(
		trpc.catalog.list.queryOptions({ q: "", kind: null }),
	);
	const create = useMutation(
		trpc.invoices.create.mutationOptions({
			onSuccess: async (invoice) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.invoices.list.queryKey(),
				});
				setOpen(false);
				setDescription("");
				setAmount("");
				toast.success(`${invoice.number} created.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const today = new Date();
	const due = new Date(today);
	due.setDate(due.getDate() + 30);

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					variant="outline"
					onClick={() => setAssistantOpen((value) => !value)}
				>
					AI invoice builder
				</Button>
				{canManageInvoices ? (
					<Button onClick={() => setOpen((value) => !value)}>
						<Add data-icon="inline-start" /> New invoice
					</Button>
				) : null}
			</div>
			{assistantOpen ? (
				<InvoiceAssistant
					companies={companies.data ?? []}
					canApprove={canManageInvoices}
					onCreated={() =>
						queryClient.invalidateQueries({
							queryKey: trpc.invoices.list.queryKey(),
						})
					}
				/>
			) : null}
			{open && canManageInvoices ? (
				<CardContent>
					<form
						className="grid gap-4 md:grid-cols-2"
						onSubmit={(event) => {
							event.preventDefault();
							const parsed = Number.parseFloat(amount);
							create.mutate({
								companyId,
								recipientEmail: recipientEmail || null,
								issueDate: toDay(today),
								dueDate: toDay(due),
								dueTime,
								currency: "JMD",
								taxCents: 0,
								lines: [
									{
										description,
										quantity: 1,
										unitPriceCents: Math.round(parsed * 100),
										catalogItemId: catalogItemId || null,
									},
								],
							});
						}}
					>
						<label className="grid gap-1 text-sm">
							Client
							<select
								className="h-9 rounded-md border bg-background px-3"
								value={companyId}
								onChange={(event) => setCompanyId(event.target.value)}
								required
							>
								<option value="">Choose a client</option>
								{(companies.data ?? []).map((company) => (
									<option key={company.id} value={company.id}>
										{company.name}
									</option>
								))}
							</select>
						</label>
						<label
							className="grid gap-1 text-sm"
							htmlFor="invoice-recipient-email"
						>
							Recipient email
							<Input
								id="invoice-recipient-email"
								type="email"
								value={recipientEmail}
								onChange={(event) => setRecipientEmail(event.target.value)}
								placeholder="accounts@client.com"
							/>
						</label>
						<label className="grid gap-1 text-sm">
							Service Portfolio item
							<select
								className="h-9 rounded-md border bg-background px-3"
								value={catalogItemId}
								onChange={(event) => {
									const id = event.target.value;
									setCatalogItemId(id);
									const item = catalog.data?.find((entry) => entry.id === id);
									if (item) setDescription(`${item.code} — ${item.name}`);
								}}
							>
								<option value="">Custom line item</option>
								{(catalog.data ?? []).map((item) => (
									<option key={item.id} value={item.id}>
										{item.code} — {item.name}
									</option>
								))}
							</select>
						</label>
						<label className="grid gap-1 text-sm" htmlFor="invoice-description">
							Description
							<Input
								id="invoice-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								required
							/>
						</label>
						<label className="grid gap-1 text-sm" htmlFor="invoice-amount">
							Amount (JMD)
							<Input
								id="invoice-amount"
								type="number"
								min="0"
								step="0.01"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								required
							/>
						</label>
						<label className="grid gap-1 text-sm" htmlFor="invoice-due-time">
							Payment due time
							<Input
								id="invoice-due-time"
								type="time"
								value={dueTime}
								onChange={(event) => setDueTime(event.target.value)}
								required
							/>
						</label>
						<Button
							type="submit"
							className="self-end"
							disabled={
								!companyId ||
								!description.trim() ||
								!(Number.parseFloat(amount) >= 0) ||
								create.isPending
							}
						>
							Create draft
						</Button>
					</form>
				</CardContent>
			) : null}
			<div className="overflow-hidden rounded-lg border bg-card">
				<div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-muted-foreground text-xs">
					<span>Invoice / client</span>
					<span>Due</span>
					<span>Total</span>
				</div>
				{(invoices.data?.rows ?? []).map((invoice) => (
					<Link
						key={invoice.id}
						href={workspaceUrl(`/invoices/${invoice.id}`)}
						className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 border-b px-4 py-4 last:border-0 hover:bg-muted/30"
					>
						<div>
							<p className="font-medium text-sm">{invoice.number}</p>
							<p className="text-muted-foreground text-xs">
								{invoice.company.name}
							</p>
						</div>
						<div>
							<Badge variant="outline">{label(invoice.status)}</Badge>
							<p className="mt-1 text-muted-foreground text-xs">
								{invoice.dueDate.slice(0, 10)}
							</p>
						</div>
						<span className="font-medium tabular-nums">
							{formatMoney(invoice.totalCents, invoice.currency)}
						</span>
					</Link>
				))}
			</div>
			{invoices.data?.rows.length === 0 ? (
				<p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
					No invoices yet.
				</p>
			) : null}
		</div>
	);
}

function InvoiceAssistant({
	companies,
	canApprove,
	onCreated,
}: {
	companies: Array<{ id: string; name: string; domain: string | null }>;
	canApprove: boolean;
	onCreated: () => Promise<unknown>;
}) {
	const trpc = useTRPC();
	const [purpose, setPurpose] = useState<"CLIENT_WORK" | "GENERAL_KNOWLEDGE">(
		"CLIENT_WORK",
	);
	const [companyId, setCompanyId] = useState("");
	const [newClient, setNewClient] = useState(false);
	const [clientName, setClientName] = useState("");
	const [clientDomain, setClientDomain] = useState("");
	const [clientEmail, setClientEmail] = useState("");
	const [clientPhone, setClientPhone] = useState("");
	const [clientNotes, setClientNotes] = useState("");
	const [sessionId, setSessionId] = useState("");
	const [prompt, setPrompt] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [reply, setReply] = useState("");
	const [missing, setMissing] = useState<string[]>([]);
	const [actionId, setActionId] = useState("");
	const [actionType, setActionType] = useState("");
	const [payload, setPayload] = useState("{}");
	const start = useMutation(
		trpc.invoices.startAssistant.mutationOptions({
			onSuccess: (session) => {
				setSessionId(session.id);
				setCompanyId(session.companyId ?? "");
				toast.success("Staff AI workspace started.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const message = useMutation(
		trpc.invoices.assistantMessage.mutationOptions({
			onSuccess: (result) => {
				const simple = result as unknown as {
					assistantMessage: string;
					missingFields: string[];
					action: null | { id: string; type: string; payload: unknown };
					draft: unknown;
				};
				setReply(simple.assistantMessage);
				setMissing(simple.missingFields);
				setActionId(simple.action?.id ?? "");
				setActionType(simple.action?.type ?? "");
				const editableDraft: unknown =
					simple.action?.payload ?? simple.draft ?? {};
				setPayload(JSON.stringify(editableDraft, null, 2));
				setFiles([]);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const approve = useMutation(
		trpc.invoices.approveAssistantAction.mutationOptions({
			onSuccess: async () => {
				await onCreated();
				setActionId("");
				toast.success("Approved action completed and audited.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<div className="rounded-xl border border-emerald-500/30 bg-card p-5 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="font-semibold">Staff AI invoice builder</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Client-bound drafts only. Nothing is posted until an administrator
						approves it.
					</p>
				</div>
				<Badge variant="outline">STAFF ONLY</Badge>
			</div>
			{!sessionId ? (
				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<label className="grid gap-1 text-sm">
						Workspace type
						<select
							className="h-9 rounded-md border bg-background px-3"
							value={purpose}
							onChange={(event) => {
								setPurpose(event.target.value as typeof purpose);
								setNewClient(false);
								setCompanyId("");
							}}
						>
							<option value="CLIENT_WORK">Client work</option>
							<option value="GENERAL_KNOWLEDGE">
								General company / knowledgebase
							</option>
						</select>
					</label>
					{purpose === "CLIENT_WORK" ? (
						<label className="grid gap-1 text-sm">
							Client
							<select
								className="h-9 rounded-md border bg-background px-3"
								value={newClient ? "__new" : companyId}
								onChange={(event) => {
									setNewClient(event.target.value === "__new");
									setCompanyId(
										event.target.value === "__new" ? "" : event.target.value,
									);
								}}
							>
								<option value="">Choose a client</option>
								<option value="__new">Create a new client…</option>
								{companies.map((company) => (
									<option key={company.id} value={company.id}>
										{company.name}
									</option>
								))}
							</select>
						</label>
					) : null}
					{newClient && purpose === "CLIENT_WORK" ? (
						<>
							<label
								className="grid gap-1 text-sm"
								htmlFor="assistant-client-name"
							>
								Client name
								<Input
									id="assistant-client-name"
									value={clientName}
									onChange={(event) => setClientName(event.target.value)}
								/>
							</label>
							<label
								className="grid gap-1 text-sm"
								htmlFor="assistant-client-domain"
							>
								Domain
								<Input
									id="assistant-client-domain"
									value={clientDomain}
									onChange={(event) => setClientDomain(event.target.value)}
									placeholder="client.com"
								/>
							</label>
							<label
								className="grid gap-1 text-sm"
								htmlFor="assistant-client-email"
							>
								Email
								<Input
									id="assistant-client-email"
									type="email"
									value={clientEmail}
									onChange={(event) => setClientEmail(event.target.value)}
								/>
							</label>
							<label
								className="grid gap-1 text-sm"
								htmlFor="assistant-client-phone"
							>
								Phone
								<Input
									id="assistant-client-phone"
									value={clientPhone}
									onChange={(event) => setClientPhone(event.target.value)}
								/>
							</label>
							<label
								className="grid gap-1 text-sm md:col-span-2"
								htmlFor="assistant-client-notes"
							>
								What staff knows about this client
								<Textarea
									id="assistant-client-notes"
									value={clientNotes}
									onChange={(event) => setClientNotes(event.target.value)}
								/>
							</label>
						</>
					) : null}
					<Button
						className="md:col-span-2"
						disabled={
							start.isPending ||
							(purpose === "CLIENT_WORK" && !companyId && !clientName.trim())
						}
						onClick={() =>
							start.mutate({
								purpose,
								companyId:
									purpose === "CLIENT_WORK" && !newClient
										? companyId || null
										: null,
								newClient: newClient
									? {
											name: clientName,
											domain: clientDomain || null,
											email: clientEmail || null,
											phone: clientPhone || null,
											staffNotes: clientNotes || null,
										}
									: null,
							})
						}
					>
						{start.isPending
							? "Starting…"
							: purpose === "GENERAL_KNOWLEDGE"
								? "Start knowledge session"
								: newClient
									? "Create client and start"
									: "Start client workspace"}
					</Button>
				</div>
			) : (
				<div className="mt-4 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
					<div className="space-y-3">
						<Textarea
							rows={8}
							value={prompt}
							onChange={(event) => setPrompt(event.target.value)}
							placeholder="Create an invoice from these files, log a payment, prepare an estimate, record an expense or create a task…"
						/>
						<Input
							type="file"
							multiple
							accept=".pdf,.doc,.docx,.txt,.csv,image/*,video/*"
							onChange={(event) =>
								setFiles(Array.from(event.target.files ?? []).slice(0, 6))
							}
						/>
						<p className="text-xs text-muted-foreground">
							Documents and images are scanned directly. For video, the original
							is retained and visual frames are extracted in your browser for
							analysis.
						</p>
						<Button
							disabled={!prompt.trim() || message.isPending}
							onClick={async () => {
								try {
									message.mutate({
										sessionId,
										prompt,
										files: await prepareAssistantFiles(files),
									});
								} catch (error) {
									toast.error(
										error instanceof Error
											? error.message
											: "The attachments could not be prepared.",
									);
								}
							}}
						>
							{message.isPending ? "Reviewing…" : "Prepare editable draft"}
						</Button>
					</div>
					<div className="space-y-3 rounded-xl bg-muted/30 p-4">
						<p className="text-xs font-medium text-emerald-500">
							ASSISTANT REVIEW
						</p>
						<p className="whitespace-pre-wrap text-sm text-muted-foreground">
							{reply ||
								"The assistant will identify the client context, scan attachments, ask for missing details and prepare a pending action."}
						</p>
						{missing.length ? (
							<div>
								<p className="text-xs font-medium">Still needed</p>
								<ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
									{missing.map((field) => (
										<li key={field}>{field}</li>
									))}
								</ul>
							</div>
						) : null}
						{actionId ? (
							<div className="space-y-2 border-t pt-3">
								<div className="flex items-center justify-between">
									<p className="text-sm font-medium">
										Editable {actionType.toLowerCase()} payload
									</p>
									<Badge variant="outline">Pending approval</Badge>
								</div>
								<Textarea
									className="font-mono text-xs"
									rows={14}
									value={payload}
									onChange={(event) => setPayload(event.target.value)}
								/>
								{canApprove ? (
									<Button
										disabled={approve.isPending}
										onClick={() => {
											try {
												approve.mutate({
													actionId,
													payload: JSON.parse(payload) as Record<
														string,
														unknown
													>,
												});
											} catch {
												toast.error("Fix the JSON before approval.");
											}
										}}
									>
										{approve.isPending
											? "Approving…"
											: `Approve and create ${actionType.toLowerCase()}`}
									</Button>
								) : (
									<p className="text-xs text-muted-foreground">
										An administrator must review and approve this action.
									</p>
								)}
							</div>
						) : null}
					</div>
				</div>
			)}
		</div>
	);
}

async function prepareAssistantFiles(files: File[]) {
	const output: Array<{
		name: string;
		mediaType: string;
		contentBase64: string;
	}> = [];
	for (const file of files) {
		if (file.size > 20_000_000) throw new Error(`${file.name} exceeds 20 MB.`);
		output.push({
			name: file.name,
			mediaType: file.type || "application/octet-stream",
			contentBase64: await fileBase64(file),
		});
		if (file.type.startsWith("video/"))
			output.push(...(await videoFrames(file)));
	}
	return output;
}

async function fileBase64(file: Blob): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (let index = 0; index < bytes.length; index += 0x8000)
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	return btoa(binary);
}

async function videoFrames(file: File) {
	const url = URL.createObjectURL(file);
	try {
		const video = document.createElement("video");
		video.src = url;
		video.muted = true;
		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(new Error(`Could not read ${file.name}.`));
		});
		const frames: Array<{
			name: string;
			mediaType: string;
			contentBase64: string;
		}> = [];
		for (const ratio of [0.15, 0.5, 0.85]) {
			video.currentTime = Math.max(0, video.duration * ratio);
			await new Promise<void>((resolve) => {
				video.onseeked = () => resolve();
			});
			const canvas = document.createElement("canvas");
			const scale = Math.min(1, 1280 / Math.max(video.videoWidth, 1));
			canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
			canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
			canvas
				.getContext("2d")
				?.drawImage(video, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, "image/jpeg", 0.82),
			);
			if (blob)
				frames.push({
					name: `${file.name}-frame-${Math.round(ratio * 100)}.jpg`,
					mediaType: "image/jpeg",
					contentBase64: await fileBase64(blob),
				});
		}
		return frames;
	} finally {
		URL.revokeObjectURL(url);
	}
}

function label(value: string): string {
	return value
		.toLowerCase()
		.replace(/^./, (character) => character.toUpperCase());
}
