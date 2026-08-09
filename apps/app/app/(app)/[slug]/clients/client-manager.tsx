"use client";

import Add from "@carbon/icons-react/es/Add";
import Email from "@carbon/icons-react/es/Email";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { Badge } from "@crm/ui/components/badge";
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
import { Switch } from "@crm/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function ClientManager() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [q, setQ] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [contactOpen, setContactOpen] = useState(false);
	const [invite, setInvite] = useState<{
		contactId: string | null;
		email: string;
	} | null>(null);
	const clients = useQuery(
		trpc.clients.list.queryOptions({ q }, { refetchInterval: 5_000 }),
	);
	useEffect(() => {
		if (!selectedId && clients.data?.[0]) setSelectedId(clients.data[0].id);
	}, [clients.data, selectedId]);
	const detail = useQuery(
		trpc.clients.detail.queryOptions(
			{ id: selectedId || "pending" },
			{ enabled: Boolean(selectedId), refetchInterval: 5_000 },
		),
	);
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: trpc.clients.list.queryKey() }),
			queryClient.invalidateQueries({
				queryKey: trpc.clients.detail.queryKey(),
			}),
		]);
	const grant = useMutation(
		trpc.portal.grant.mutationOptions({
			onSuccess: async () => {
				await refresh();
				setInvite(null);
				toast.success("Secure client invitation sent.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const revoke = useMutation(
		trpc.portal.revoke.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeAccess = useMutation(
		trpc.portal.removeAccess.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Portal login removed immediately.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const deleteContact = useMutation(
		trpc.clients.deleteContact.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Contact and linked login removed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const account = detail.data;
	return (
		<div className="grid min-h-0 gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
			<aside className="overflow-hidden rounded-xl border bg-card">
				<div className="border-b p-3">
					<div className="flex gap-2">
						<Input
							value={q}
							onChange={(event) => setQ(event.target.value)}
							placeholder="Search client accounts"
						/>
						<Button
							size="icon"
							onClick={() => setCreateOpen(true)}
							aria-label="Create client"
						>
							<Add />
						</Button>
					</div>
				</div>
				<div className="max-h-[calc(100svh-15rem)] overflow-y-auto">
					{(clients.data ?? []).map((client) => (
						<button
							key={client.id}
							type="button"
							onClick={() => setSelectedId(client.id)}
							className={`w-full border-b p-4 text-left transition-colors hover:bg-muted/40 ${selectedId === client.id ? "bg-emerald-500/[.08]" : ""}`}
						>
							<div className="flex items-center gap-2">
								<span className="truncate text-sm font-medium">
									{client.name}
								</span>
								{client._count.portalAccesses ? (
									<span className="ml-auto size-2 rounded-full bg-emerald-500" />
								) : null}
							</div>
							<p className="mt-1 truncate text-xs text-muted-foreground">
								{client.domain || "Domain not configured"}
							</p>
							<p className="mt-2 text-[11px] text-muted-foreground">
								{client._count.contacts} contacts · {client._count.projects}{" "}
								projects · {client._count.invoices} invoices
							</p>
						</button>
					))}
				</div>
			</aside>
			{account ? (
				<main className="min-w-0 space-y-4">
					<section className="overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_85%_0%,rgba(108,211,44,.16),transparent_30%),var(--card)]">
						<div className="p-5">
							<div className="flex flex-wrap items-start gap-4">
								<div>
									<p className="font-mono text-[10px] text-emerald-500 uppercase">
										Client account / {account.domain || "no domain"}
									</p>
									<h2 className="mt-2 text-2xl tracking-tight">
										{account.name}
									</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										{account.industry || "Industry not set"} ·{" "}
										{account.city || account.country || "Location not set"}
									</p>
								</div>
								<div className="ml-auto flex gap-2">
									<Button
										variant="outline"
										onClick={() => setContactOpen(true)}
									>
										<Add data-icon="inline-start" /> Add contact
									</Button>
									<Button
										onClick={() => {
											const primary =
												account.contacts.find(
													(item) => item.id === account.primaryContactId,
												) ?? account.contacts[0];
											setInvite({
												contactId: primary?.id ?? null,
												email: primary?.email ?? "",
											});
										}}
									>
										<Email data-icon="inline-start" /> Invite to portal
									</Button>
								</div>
							</div>
							<div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
								<AccountMetric
									label="Contacts"
									value={String(account.contacts.length)}
								/>
								<AccountMetric
									label="Portal users"
									value={String(
										account.portalAccesses.filter((item) => item.active).length,
									)}
								/>
								<AccountMetric
									label="Projects"
									value={String(account.projects.length)}
								/>
								<AccountMetric
									label="Invoices"
									value={String(account.invoices.length)}
								/>
								<AccountMetric
									label="Requests"
									value={String(account.serviceRequests.length)}
								/>
							</div>
						</div>
					</section>
					<Tabs defaultValue="contacts">
						<TabsList className="h-auto flex-wrap justify-start">
							<TabsTrigger value="contacts">Contacts & access</TabsTrigger>
							<TabsTrigger value="projects">Projects</TabsTrigger>
							<TabsTrigger value="billing">Billing</TabsTrigger>
							<TabsTrigger value="deals">Deals</TabsTrigger>
							<TabsTrigger value="support">Service history</TabsTrigger>
						</TabsList>
						<TabsContent value="contacts">
							<Section
								title="Account contacts"
								description="Primary contact, decision makers and secure portal access."
							>
								<div className="divide-y rounded-lg border">
									{account.contacts.map((contact) => {
										const access = account.portalAccesses.find(
											(item) =>
												item.contactId === contact.id ||
												item.email === contact.email,
										);
										return (
											<div
												key={contact.id}
												className="flex flex-wrap items-center gap-3 p-3"
											>
												<div>
													<p className="text-sm font-medium">
														{contact.firstName} {contact.lastName}
													</p>
													<p className="text-xs text-muted-foreground">
														{contact.title || "Contact"} ·{" "}
														{contact.email || "No email"}
													</p>
												</div>
												{contact.id === account.primaryContactId ? (
													<Badge>Primary</Badge>
												) : null}
												<div className="ml-auto flex items-center gap-2">
													{access ? (
														<Badge
															variant={access.active ? "default" : "outline"}
														>
															{access.active ? "Portal active" : "Revoked"}
														</Badge>
													) : (
														<Badge variant="outline">No login</Badge>
													)}
													{contact.email && !access ? (
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																setInvite({
																	contactId: contact.id,
																	email: contact.email || "",
																})
															}
														>
															Invite
														</Button>
													) : null}
											{access?.active ? (
														<Button
															size="sm"
															variant="ghost"
															onClick={() => revoke.mutate({ id: access.id })}
														>
															Revoke
														</Button>
											) : null}
											{access ? (
												<Button
													size="sm"
													variant="ghost"
													onClick={() => removeAccess.mutate({ id: access.id })}
												>
													Remove login
												</Button>
											) : null}
											<Button
												size="icon-sm"
												variant="ghost"
												aria-label={`Delete ${contact.firstName}`}
												onClick={() => deleteContact.mutate({
													companyId: account.id,
													contactId: contact.id,
												})}
											>
												<TrashCan />
											</Button>
												</div>
											</div>
										);
									})}
								</div>
								<div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
									Login policy: invitations accept Gmail addresses or the
									configured client company domain (
									{account.domain || "add a domain first"}). Yahoo, Outlook.com
									and unrelated domains are blocked for client portal access.
								</div>
							</Section>
						</TabsContent>
						<TabsContent value="projects">
							<Section
								title="Project portfolio"
								description="Current delivery status and work structure."
							>
								<Rows
									empty="No projects yet."
									rows={account.projects.map((item) => ({
										id: item.id,
										title: item.name,
										detail: `${label(item.status)} · ${item._count.tasks} tasks · ${item._count.invoices} invoices`,
										badge: item.dueDate
											? new Date(item.dueDate).toLocaleDateString()
											: "No due date",
									}))}
								/>
							</Section>
						</TabsContent>
						<TabsContent value="billing">
							<Section
								title="Invoices & revenue"
								description="Client billing and collection status."
							>
								<Rows
									empty="No invoices yet."
									rows={account.invoices.map((item) => ({
										id: item.id,
										title: item.number,
										detail: `${formatMoney(item.amountPaidCents, item.currency)} paid of ${formatMoney(item.totalCents, item.currency)}`,
										badge: label(item.status),
									}))}
								/>
							</Section>
						</TabsContent>
						<TabsContent value="deals">
							<Section
								title="Commercial opportunities"
								description="Pipeline connected to this account."
							>
								<Rows
									empty="No deals yet."
									rows={account.deals.map((item) => ({
										id: item.id,
										title: item.name,
										detail:
											item.amountCents == null
												? "Value not set"
												: formatMoney(item.amountCents, item.currency),
										badge: label(item.stage),
									}))}
								/>
							</Section>
						</TabsContent>
						<TabsContent value="support">
							<Section
								title="Tickets & service requests"
								description="Support, change, billing, access and integration history."
							>
								<Rows
									empty="No service requests yet."
									rows={account.serviceRequests.map((item) => ({
										id: item.id,
										title: `${item.reference} · ${item.title}`,
										detail: `Updated ${new Date(item.updatedAt).toLocaleDateString()}`,
										badge: `${label(item.priority)} · ${label(item.status)}`,
									}))}
								/>
							</Section>
						</TabsContent>
					</Tabs>
				</main>
			) : (
				<div className="m-auto text-sm text-muted-foreground">
					Select a client account.
				</div>
			)}
			<ClientAccountDialog
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onSaved={refresh}
			/>
			{selectedId ? (
				<ClientContactDialog
					open={contactOpen}
					companyId={selectedId}
					onClose={() => setContactOpen(false)}
					onSaved={refresh}
				/>
			) : null}
			<Dialog
				open={Boolean(invite)}
				onOpenChange={(open) => !open && setInvite(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite client portal user</DialogTitle>
						<DialogDescription>
							The link lets the contact create a password or use Google sign-in.
							Access is scoped to this client account.
						</DialogDescription>
					</DialogHeader>
					<Field label="Gmail or company-domain email">
						<Input
							type="email"
							value={invite?.email ?? ""}
							onChange={(event) =>
								setInvite((current) =>
									current ? { ...current, email: event.target.value } : null,
								)
							}
						/>
					</Field>
					<DialogFooter>
						<Button variant="outline" onClick={() => setInvite(null)}>
							Cancel
						</Button>
						<Button
							disabled={!invite?.email || grant.isPending}
							onClick={() =>
								invite &&
								selectedId &&
								grant.mutate({
									companyId: selectedId,
									contactId: invite.contactId,
									email: invite.email,
								})
							}
						>
							Send secure invite
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ClientAccountDialog({
	open,
	onClose,
	onSaved,
}: {
	open: boolean;
	onClose: () => void;
	onSaved: () => Promise<unknown>;
}) {
	const trpc = useTRPC();
	const [v, setV] = useState<Record<string, string>>({});
	const [sendInvite, setSendInvite] = useState(true);
	const create = useMutation(
		trpc.clients.createAccount.mutationOptions({
			onSuccess: async () => {
				await onSaved();
				onClose();
				setV({});
				toast.success("Client account created.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) =>
		setV((x) => ({ ...x, [key]: event.target.value }));
	return (
		<Dialog open={open} onOpenChange={(value) => !value && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create client account</DialogTitle>
					<DialogDescription>
						Create the company and its primary contact together, then optionally
						send secure portal access.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3">
					<Field label="Company name">
						<Input value={v.name || ""} onChange={set("name")} />
					</Field>
					<Field label="Company domain">
						<Input
							placeholder="clientcompany.com"
							value={v.domain || ""}
							onChange={set("domain")}
						/>
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Industry">
							<Input value={v.industry || ""} onChange={set("industry")} />
						</Field>
						<Field label="Company phone">
							<Input value={v.phone || ""} onChange={set("phone")} />
						</Field>
					</div>
					<p className="mt-2 text-xs font-medium text-emerald-500">
						PRIMARY CONTACT
					</p>
					<div className="grid grid-cols-2 gap-3">
						<Field label="First name">
							<Input value={v.firstName || ""} onChange={set("firstName")} />
						</Field>
						<Field label="Last name">
							<Input value={v.lastName || ""} onChange={set("lastName")} />
						</Field>
					</div>
					<Field label="Gmail or company-domain email">
						<Input type="email" value={v.email || ""} onChange={set("email")} />
					</Field>
					<Field label="Role / title">
						<Input value={v.title || ""} onChange={set("title")} />
					</Field>
					<div className="flex items-center justify-between rounded-lg border p-3 text-sm">
						<span>Send client portal invitation</span>
						<Switch checked={sendInvite} onCheckedChange={setSendInvite} />
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={
							!v.name ||
							!v.domain ||
							!v.firstName ||
							!v.email ||
							create.isPending
						}
						onClick={() =>
							create.mutate({
								name: v.name || "",
								domain: v.domain || "",
								phone: v.phone || null,
								industry: v.industry || null,
								contactFirstName: v.firstName || "",
								contactLastName: v.lastName || null,
								contactEmail: v.email || "",
								contactPhone: null,
								contactTitle: v.title || null,
								sendInvite,
							})
						}
					>
						Create account
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
function ClientContactDialog({
	open,
	companyId,
	onClose,
	onSaved,
}: {
	open: boolean;
	companyId: string;
	onClose: () => void;
	onSaved: () => Promise<unknown>;
}) {
	const trpc = useTRPC();
	const [v, setV] = useState<Record<string, string>>({});
	const [primary, setPrimary] = useState(false);
	const [sendInvite, setSendInvite] = useState(false);
	const create = useMutation(
		trpc.clients.addContact.mutationOptions({
			onSuccess: async () => {
				await onSaved();
				onClose();
				setV({});
				toast.success("Client contact added.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) =>
		setV((x) => ({ ...x, [key]: event.target.value }));
	return (
		<Dialog open={open} onOpenChange={(value) => !value && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add account contact</DialogTitle>
					<DialogDescription>
						Add a decision maker, billing contact, operational contact or portal
						user.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3">
					<div className="grid grid-cols-2 gap-3">
						<Field label="First name">
							<Input onChange={set("firstName")} />
						</Field>
						<Field label="Last name">
							<Input onChange={set("lastName")} />
						</Field>
					</div>
					<Field label="Gmail or company-domain email">
						<Input type="email" onChange={set("email")} />
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Role / title">
							<Input onChange={set("title")} />
						</Field>
						<Field label="Phone">
							<Input onChange={set("phone")} />
						</Field>
					</div>
					<Toggle
						label="Set as primary contact"
						value={primary}
						onChange={setPrimary}
					/>
					<Toggle
						label="Send portal invitation"
						value={sendInvite}
						onChange={setSendInvite}
					/>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!v.firstName || !v.email || create.isPending}
						onClick={() =>
							create.mutate({
								companyId,
								firstName: v.firstName || "",
								lastName: v.lastName || null,
								email: v.email || "",
								phone: v.phone || null,
								title: v.title || null,
								primary,
								sendInvite,
							})
						}
					>
						Add contact
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
function AccountMetric({
	label: text,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-lg border border-white/10 bg-black/10 p-3">
			<p className="text-xs text-muted-foreground">{text}</p>
			<p className="mt-1 text-lg">{value}</p>
		</div>
	);
}
function Section({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-xl border bg-card">
			<div className="border-b p-4">
				<h3 className="font-medium">{title}</h3>
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			</div>
			<div className="p-4">{children}</div>
		</section>
	);
}
function Rows({
	rows,
	empty,
}: {
	rows: Array<{ id: string; title: string; detail: string; badge: string }>;
	empty: string;
}) {
	return (
		<div className="divide-y rounded-lg border">
			{rows.length ? (
				rows.map((row) => (
					<div key={row.id} className="flex items-center gap-3 p-3">
						<div>
							<p className="text-sm font-medium">{row.title}</p>
							<p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
						</div>
						<Badge className="ml-auto" variant="outline">
							{row.badge}
						</Badge>
					</div>
				))
			) : (
				<p className="p-5 text-sm text-muted-foreground">{empty}</p>
			)}
		</div>
	);
}
function Field({
	label: text,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid gap-1.5 text-xs text-muted-foreground">
			<span>{text}</span>
			{children}
		</div>
	);
}
function Toggle({
	label: text,
	value,
	onChange,
}: {
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border p-3 text-sm">
			<span>{text}</span>
			<Switch checked={value} onCheckedChange={onChange} />
		</div>
	);
}
function label(value: string) {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/^./, (c) => c.toUpperCase());
}
