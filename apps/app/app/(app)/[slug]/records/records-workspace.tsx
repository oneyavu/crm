"use client";

import Add from "@carbon/icons-react/es/Add";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
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
import { TablePagination } from "@crm/ui/components/table-pagination";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

const TYPES = [
	"ESTIMATE",
	"EXPENSE",
	"CONTRACT",
	"TICKET",
	"STAFF",
	"TASK",
	"NOTE",
	"PAYMENT",
] as const;

type RecordRow = {
	id: string;
	type: (typeof TYPES)[number];
	reference: string | null;
	title: string;
	status: string | null;
	description: string | null;
	amountCents: number | null;
	currency: string | null;
	occurredAt: string | null;
	dueAt: string | null;
	company: { id: string; name: string } | null;
	project: { id: string; name: string } | null;
};

export function RecordsWorkspace() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [q, setQ] = useState("");
	const [type, setType] = useState("all");
	const [selected, setSelected] = useState<RecordRow | null>(null);
	const [deleting, setDeleting] = useState<RecordRow | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const records = useQuery(
		trpc.records.list.queryOptions({
			q,
			type,
			page,
			pageSize: 25,
			sort: "occurredAt",
			dir: "desc",
		}),
	);
	const rows = (records.data?.rows ?? []) as RecordRow[];
	const totalPages = Math.max(1, Math.ceil((records.data?.total ?? 0) / 25));
	const remove = useMutation(
		trpc.records.delete.mutationOptions({
			onSuccess: async (record) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.records.list.queryKey(),
				});
				if (selected?.id === record.id) setSelected(null);
				setDeleting(null);
				toast.success(`${record.title} deleted.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
			<section className="flex min-w-0 flex-col gap-4">
				<div className="flex flex-wrap items-center gap-2 border-b pb-4">
					<Input
						className="min-w-56 flex-1"
						placeholder="Search records, references or companies"
						value={q}
						onChange={(event) => {
							setQ(event.target.value);
							setPage(1);
						}}
					/>
					<Select
						value={type}
						onValueChange={(value) => {
							setType(value);
							setPage(1);
						}}
					>
						<SelectTrigger aria-label="Record type">
							<SelectValue placeholder="All record types" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="all">All record types</SelectItem>
								{TYPES.map((value) => (
									<SelectItem key={value} value={value}>
										{label(value)}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Button onClick={() => setCreateOpen(true)}>
						<Add data-icon="inline-start" /> Add record
					</Button>
				</div>

				<div className="overflow-hidden rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Reference</TableHead>
								<TableHead>Title</TableHead>
								<TableHead>Company</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Amount</TableHead>
								<TableHead>Date</TableHead>
								<TableHead aria-label="Actions" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((record) => (
								<TableRow
									key={record.id}
									data-state={
										selected?.id === record.id ? "selected" : undefined
									}
								>
									<TableCell className="text-muted-foreground tabular-nums">
										{record.reference ?? label(record.type)}
									</TableCell>
									<TableCell>
										<Button variant="link" onClick={() => setSelected(record)}>
											{record.title}
										</Button>
									</TableCell>
									<TableCell>{record.company?.name ?? "—"}</TableCell>
									<TableCell>
										<Badge variant="outline">
											{record.status || label(record.type)}
										</Badge>
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{record.amountCents === null
											? "—"
											: formatMoney(
													record.amountCents,
													record.currency ?? "JMD",
												)}
									</TableCell>
									<TableCell className="text-muted-foreground tabular-nums">
										{record.occurredAt
											? new Date(record.occurredAt).toLocaleDateString()
											: "—"}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Delete ${record.title}`}
											onClick={() => setDeleting(record)}
										>
											<TrashCan />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				<TablePagination
					page={page}
					totalPages={totalPages}
					pageSize={25}
					total={records.data?.total ?? 0}
					loading={records.isFetching}
					onPageChange={setPage}
				/>
			</section>

			<RecordDetail record={selected ?? rows[0] ?? null} />
			<CreateRecordDialog open={createOpen} onOpenChange={setCreateOpen} />
			<AlertDialog
				open={Boolean(deleting)}
				onOpenChange={(open) => !open && setDeleting(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this record?</AlertDialogTitle>
						<AlertDialogDescription>
							This cannot be undone. {deleting?.reference ?? deleting?.title}{" "}
							will be permanently deleted.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={() => deleting && remove.mutate({ id: deleting.id })}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function RecordDetail({ record }: { record: RecordRow | null }) {
	if (!record) {
		return (
			<aside className="hidden border-l pl-6 text-muted-foreground xl:block">
				Select a record to inspect its details.
			</aside>
		);
	}
	return (
		<aside className="hidden border-l pl-6 xl:block">
			<div className="sticky top-0 flex flex-col gap-5">
				<div>
					<Badge variant="outline">{label(record.type)}</Badge>
					<h2 className="mt-3 text-xl tracking-tight">
						{record.reference ?? record.title}
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						{record.status || "No status"}
					</p>
				</div>
				<dl className="grid gap-4 border-y py-5 text-sm">
					<Detail term="Title" value={record.title} />
					<Detail term="Company" value={record.company?.name ?? "Unlinked"} />
					<Detail term="Project" value={record.project?.name ?? "Unlinked"} />
					<Detail
						term="Amount"
						value={
							record.amountCents === null
								? "—"
								: formatMoney(record.amountCents, record.currency ?? "JMD")
						}
					/>
					<Detail
						term="Due"
						value={
							record.dueAt ? new Date(record.dueAt).toLocaleDateString() : "—"
						}
					/>
				</dl>
				{record.description ? (
					<p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
						{record.description}
					</p>
				) : null}
			</div>
		</aside>
	);
}

function Detail({ term, value }: { term: string; value: string }) {
	return (
		<div className="grid grid-cols-[5rem_1fr] gap-3">
			<dt className="text-muted-foreground">{term}</dt>
			<dd>{value}</dd>
		</div>
	);
}

function CreateRecordDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [type, setType] = useState<(typeof TYPES)[number]>("ESTIMATE");
	const [title, setTitle] = useState("");
	const [reference, setReference] = useState("");
	const [status, setStatus] = useState("");
	const [amount, setAmount] = useState("");
	const [companyId, setCompanyId] = useState("");
	const [projectId, setProjectId] = useState("");
	const [description, setDescription] = useState("");
	const companies = useQuery(trpc.companies.options.queryOptions({ q: "" }));
	const projects = useQuery(trpc.projects.options.queryOptions());
	const projectOptions = useMemo(() => projects.data ?? [], [projects.data]);
	const create = useMutation(
		trpc.records.create.mutationOptions({
			onSuccess: async (record) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.records.list.queryKey(),
				});
				setTitle("");
				setReference("");
				setStatus("");
				setAmount("");
				setDescription("");
				onOpenChange(false);
				toast.success(`${record.title} created.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add business record</DialogTitle>
					<DialogDescription>
						Create a record and optionally link it to a company or project.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							type,
							title,
							reference: reference || null,
							status: status || null,
							amountCents: amount ? Math.round(Number(amount) * 100) : null,
							currency: amount ? "JMD" : null,
							companyId: companyId || null,
							projectId: projectId || null,
							description: description || null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel>Type</FieldLabel>
							<Select
								value={type}
								onValueChange={(value) => setType(value as typeof type)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{TYPES.map((value) => (
											<SelectItem key={value} value={value}>
												{label(value)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="record-title">Title</FieldLabel>
							<Input
								id="record-title"
								required
								value={title}
								onChange={(event) => setTitle(event.target.value)}
							/>
						</Field>
						<div className="grid grid-cols-2 gap-4">
							<Field>
								<FieldLabel htmlFor="record-reference">Reference</FieldLabel>
								<Input
									id="record-reference"
									value={reference}
									onChange={(event) => setReference(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="record-status">Status</FieldLabel>
								<Input
									id="record-status"
									value={status}
									onChange={(event) => setStatus(event.target.value)}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor="record-amount">Amount in JMD</FieldLabel>
							<Input
								id="record-amount"
								inputMode="decimal"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Company</FieldLabel>
							<Select
								value={companyId || "none"}
								onValueChange={(value) =>
									setCompanyId(value === "none" ? "" : value)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="No company" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value="none">No company</SelectItem>
										{(companies.data ?? []).map((company) => (
											<SelectItem key={company.id} value={company.id}>
												{company.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel>Project</FieldLabel>
							<Select
								value={projectId || "none"}
								onValueChange={(value) =>
									setProjectId(value === "none" ? "" : value)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="No project" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value="none">No project</SelectItem>
										{projectOptions.map((project) => (
											<SelectItem key={project.id} value={project.id}>
												{project.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="record-description">Description</FieldLabel>
							<Textarea
								id="record-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter className="mt-5">
						<Button type="submit" disabled={!title.trim() || create.isPending}>
							Create record
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function label(value: string): string {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/^./, (character) => character.toUpperCase());
}
