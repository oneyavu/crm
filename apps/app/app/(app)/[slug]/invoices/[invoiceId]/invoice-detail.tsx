"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Send from "@carbon/icons-react/es/Send";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { CardContent } from "@crm/ui/components/card";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const router = useRouter();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const invoice = useQuery(trpc.invoices.byId.queryOptions({ id: invoiceId }));
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.invoices.byId.queryKey({ id: invoiceId }),
		});
	const send = useMutation(
		trpc.invoices.send.mutationOptions({
			onSuccess: async (result) => {
				await refresh();
				result.sent
					? toast.success("Invoice sent.")
					: toast.error(
							result.reason === "not-configured"
								? "Email sending is not configured yet."
								: "Email delivery failed.",
						);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const paid = useMutation(
		trpc.invoices.setStatus.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Invoice marked paid.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		trpc.invoices.delete.mutationOptions({
			onSuccess: async (deleted) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.invoices.list.queryKey(),
				});
				toast.success(`${deleted.number} deleted.`);
				router.push(workspaceUrl("/invoices"));
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const data = invoice.data;
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{data?.number ?? "Invoice"}</PageShellTitle>
					<PageShellDescription>
						{data
							? `${data.company.name} · Due ${data.dueDate.slice(0, 10)}`
							: "Loading invoice"}
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Link
						href={workspaceUrl("/invoices")}
						className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
					>
						<ArrowLeft /> Invoices
					</Link>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => setDeleteOpen(true)}>
							<TrashCan data-icon="inline-start" /> Delete
						</Button>
						<Button
							variant="outline"
							onClick={() => paid.mutate({ id: invoiceId, status: "PAID" })}
							disabled={data?.status === "PAID" || paid.isPending}
						>
							Mark paid
						</Button>
						<Button
							onClick={() => send.mutate({ id: invoiceId })}
							disabled={!data?.recipientEmail || send.isPending}
						>
							<Send data-icon="inline-start" /> Send invoice
						</Button>
					</div>
				</div>
				{data ? (
					<CardContent className="mx-auto w-full max-w-3xl gap-6">
						<div className="flex justify-between gap-6">
							<div>
								<p className="text-muted-foreground text-xs uppercase tracking-wider">
									Bill to
								</p>
								<p className="mt-1 font-medium">
									{data.recipientName ?? data.company.name}
								</p>
								<p className="text-muted-foreground text-sm">
									{data.recipientEmail ?? "No recipient email"}
								</p>
							</div>
							<div className="text-right">
								<Badge>{data.status}</Badge>
								<p className="mt-3 text-muted-foreground text-xs">
									Issued {data.issueDate.slice(0, 10)}
								</p>
							</div>
						</div>
						<div className="divide-y rounded-md border">
							{data.lines.map((line) => (
								<div
									key={line.id}
									className="grid grid-cols-[1fr_auto] gap-4 p-4"
								>
									<div>
										<p className="font-medium text-sm">{line.description}</p>
										<p className="text-muted-foreground text-xs">
											Qty {line.quantity}
										</p>
									</div>
									<span className="tabular-nums">
										{formatMoney(line.amountCents, data.currency)}
									</span>
								</div>
							))}
						</div>
						<div className="ml-auto grid w-full max-w-xs grid-cols-2 gap-2 text-sm">
							<span className="text-muted-foreground">Subtotal</span>
							<span className="text-right tabular-nums">
								{formatMoney(data.subtotalCents, data.currency)}
							</span>
							<span className="text-muted-foreground">Tax</span>
							<span className="text-right tabular-nums">
								{formatMoney(data.taxCents, data.currency)}
							</span>
							<span className="font-medium">Total</span>
							<span className="text-right font-medium tabular-nums">
								{formatMoney(data.totalCents, data.currency)}
							</span>
						</div>
					</CardContent>
				) : null}
				<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
							<AlertDialogDescription>
								{data?.number ?? "This invoice"} and its line items will be
								permanently deleted.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								disabled={remove.isPending}
								onClick={() => remove.mutate({ id: invoiceId })}
							>
								Delete invoice
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</PageShellContent>
		</PageShell>
	);
}
