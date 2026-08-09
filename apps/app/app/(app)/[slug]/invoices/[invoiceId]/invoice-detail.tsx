"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import Printer from "@carbon/icons-react/es/Printer";
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
import { InvoiceDocument } from "./invoice-document";

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const router = useRouter();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [scheduleKind, setScheduleKind] = useState<
		"RECURRING_INVOICE" | "SUBSCRIPTION"
	>("RECURRING_INVOICE");
	const [cadence, setCadence] = useState<
		"WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"
	>("MONTHLY");
	const [nextIssueAt, setNextIssueAt] = useState("");
	const [paymentTermsDays, setPaymentTermsDays] = useState("7");
	const [dueTime, setDueTime] = useState("17:00");
	const [sendAutomatically, setSendAutomatically] = useState(false);
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const canManageInvoices = Boolean(
		workspace.data?.permissions.manageWorkspace,
	);
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
	const duplicate = useMutation(
		trpc.invoices.duplicate.mutationOptions({
			onSuccess: async (created) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.invoices.list.queryKey(),
				});
				toast.success(`${created.number} created from this invoice.`);
				router.push(workspaceUrl(`/invoices/${created.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const saveSchedule = useMutation(
		trpc.invoices.saveSchedule.mutationOptions({
			onSuccess: async () => {
				setScheduleOpen(false);
				await refresh();
				toast.success("Billing schedule saved.");
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
				<div className="print:hidden flex flex-wrap items-center justify-between gap-3">
					<Link
						href={workspaceUrl("/invoices")}
						className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
					>
						<ArrowLeft /> Invoices
					</Link>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => window.print()}
							disabled={!data}
						>
							<Printer data-icon="inline-start" /> Print / Save PDF
						</Button>
						{canManageInvoices ? (
							<Button
								variant="outline"
								onClick={() => duplicate.mutate({ id: invoiceId })}
								disabled={duplicate.isPending}
							>
								Duplicate
							</Button>
						) : null}
						{canManageInvoices ? (
							<Button
								variant="outline"
								onClick={() => {
									if (!nextIssueAt) {
										const next = new Date();
										next.setUTCMonth(next.getUTCMonth() + 1);
										setNextIssueAt(next.toISOString().slice(0, 16));
									}
									setScheduleOpen(true);
								}}
							>
								{data?.templateSchedule ? "Edit schedule" : "Make recurring"}
							</Button>
						) : null}
						{canManageInvoices ? (
							<Button variant="outline" onClick={() => setDeleteOpen(true)}>
								<TrashCan data-icon="inline-start" /> Delete
							</Button>
						) : null}
						{canManageInvoices ? (
							<Button
								variant="outline"
								onClick={() => paid.mutate({ id: invoiceId, status: "PAID" })}
								disabled={data?.status === "PAID" || paid.isPending}
							>
								Mark paid
							</Button>
						) : null}
						<Button
							onClick={() => send.mutate({ id: invoiceId })}
							disabled={!data?.recipientEmail || send.isPending}
						>
							<Send data-icon="inline-start" /> Send invoice
						</Button>
					</div>
				</div>
				{data ? <InvoiceDocument invoice={data} /> : null}
				<Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Recurring billing</DialogTitle>
							<DialogDescription>
								Use this invoice as the template. Each cycle creates a new
								auditable invoice and preserves prior records.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="grid gap-1" htmlFor="billing-kind">
								Billing type
								<select
									id="billing-kind"
									className="h-8 rounded-md border bg-background px-2"
									value={scheduleKind}
									onChange={(event) =>
										setScheduleKind(event.target.value as typeof scheduleKind)
									}
								>
									<option value="RECURRING_INVOICE">Recurring invoice</option>
									<option value="SUBSCRIPTION">Subscription</option>
								</select>
							</label>
							<label className="grid gap-1" htmlFor="billing-cadence">
								Cadence
								<select
									id="billing-cadence"
									className="h-8 rounded-md border bg-background px-2"
									value={cadence}
									onChange={(event) =>
										setCadence(event.target.value as typeof cadence)
									}
								>
									<option value="WEEKLY">Weekly</option>
									<option value="MONTHLY">Monthly</option>
									<option value="QUARTERLY">Quarterly</option>
									<option value="SEMIANNUAL">Semiannual</option>
									<option value="ANNUAL">Annual</option>
								</select>
							</label>
							<label className="grid gap-1" htmlFor="billing-next">
								Next issue date and time
								<Input
									id="billing-next"
									type="datetime-local"
									value={nextIssueAt}
									onChange={(event) => setNextIssueAt(event.target.value)}
								/>
							</label>
							<label className="grid gap-1" htmlFor="billing-terms">
								Payment terms (days)
								<Input
									id="billing-terms"
									type="number"
									min="0"
									max="365"
									value={paymentTermsDays}
									onChange={(event) => setPaymentTermsDays(event.target.value)}
								/>
							</label>
							<label className="grid gap-1" htmlFor="billing-due-time">
								Payment due time
								<Input
									id="billing-due-time"
									type="time"
									value={dueTime}
									onChange={(event) => setDueTime(event.target.value)}
								/>
							</label>
							<label className="flex items-center gap-2 self-end">
								<input
									type="checkbox"
									checked={sendAutomatically}
									onChange={(event) =>
										setSendAutomatically(event.target.checked)
									}
								/>
								Email each generated invoice automatically
							</label>
						</div>
						<p className="text-muted-foreground text-xs">
							Admin and client reminders: 7, 3 and 1 day before, plus the due
							date.
						</p>
						<DialogFooter>
							<Button variant="outline" onClick={() => setScheduleOpen(false)}>
								Cancel
							</Button>
							<Button
								disabled={!nextIssueAt || saveSchedule.isPending}
								onClick={() =>
									saveSchedule.mutate({
										templateInvoiceId: invoiceId,
										kind: scheduleKind,
										cadence,
										interval: 1,
										nextIssueAt: new Date(nextIssueAt).toISOString(),
										paymentTermsDays: Number(paymentTermsDays),
										dueTime,
										active: true,
										sendAutomatically,
										remindAdmin: true,
										remindClient: true,
										reminderDays: [7, 3, 1, 0],
									})
								}
							>
								Save schedule
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				{canManageInvoices ? (
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
				) : null}
			</PageShellContent>
		</PageShell>
	);
}
