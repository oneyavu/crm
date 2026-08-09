"use client";

import Add from "@carbon/icons-react/es/Add";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { CardContent } from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
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
	const [companyId, setCompanyId] = useState("");
	const [recipientEmail, setRecipientEmail] = useState("");
	const [catalogItemId, setCatalogItemId] = useState("");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
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
			<div className="flex justify-end">
				<Button onClick={() => setOpen((value) => !value)}>
					<Add data-icon="inline-start" /> New invoice
				</Button>
			</div>
			{open ? (
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
							VAYU catalog item
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

function label(value: string): string {
	return value
		.toLowerCase()
		.replace(/^./, (character) => character.toUpperCase());
}
