"use client";

import Add from "@carbon/icons-react/es/Add";
import Edit from "@carbon/icons-react/es/Edit";
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
import { Switch } from "@crm/ui/components/switch";
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
import { useEffect, useMemo, useState } from "react";
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
	includedInFinancials: boolean;
	billable: boolean;
	clientVisible: boolean;
	expenseScope: "COMPANY" | "CLIENT" | "PROJECT" | null;
	category: { id: string; name: string } | null;
	financialAccount: { id: string; name: string } | null;
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
	const [editing, setEditing] = useState<RecordRow | null>(null);
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
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
					{TYPES.map((value) => (
						<Button
							key={value}
							variant={type === value ? "default" : "outline"}
							size="sm"
							onClick={() => {
								setType(value);
								setPage(1);
							}}
						>
							{label(value)}{" "}
							<span className="ml-auto opacity-60">
								{records.data?.facetCounts?.type?.[value] ?? 0}
							</span>
						</Button>
					))}
				</div>
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
					<Button
						variant="outline"
						onClick={() => {
							setType("all");
							setPage(1);
						}}
					>
						All records
					</Button>
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

			<RecordDetail record={selected ?? rows[0] ?? null} onEdit={setEditing} />
			<RecordDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				record={null}
			/>
			<RecordDialog
				open={Boolean(editing)}
				onOpenChange={(open) => !open && setEditing(null)}
				record={editing}
			/>
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

function RecordDetail({
	record,
	onEdit,
}: {
	record: RecordRow | null;
	onEdit: (record: RecordRow) => void;
}) {
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
				<Button variant="outline" onClick={() => onEdit(record)}>
					<Edit data-icon="inline-start" /> Edit record
				</Button>
				<dl className="grid gap-4 border-y py-5 text-sm">
					<Detail term="Title" value={record.title} />
					<Detail term="Company" value={record.company?.name ?? "Unlinked"} />
					<Detail term="Project" value={record.project?.name ?? "Unlinked"} />
					<Detail
						term="Category"
						value={record.category?.name ?? "Uncategorized"}
					/>
					<Detail
						term="Paid from"
						value={record.financialAccount?.name ?? "Unassigned"}
					/>
					<Detail
						term="Financials"
						value={record.includedInFinancials ? "Included" : "Excluded"}
					/>
					<Detail
						term="Client"
						value={record.clientVisible ? "Visible" : "Internal"}
					/>
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

function RecordDialog({
	open,
	onOpenChange,
	record,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	record: RecordRow | null;
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
	const [includedInFinancials, setIncludedInFinancials] = useState(true);
	const [billable, setBillable] = useState(false);
	const [clientVisible, setClientVisible] = useState(false);
	const [expenseScope, setExpenseScope] = useState<
		"COMPANY" | "CLIENT" | "PROJECT"
	>("COMPANY");
	const [categoryId, setCategoryId] = useState("");
	const [financialAccountId, setFinancialAccountId] = useState("");
	const companies = useQuery(trpc.companies.options.queryOptions({ q: "" }));
	const projects = useQuery(trpc.projects.options.queryOptions());
	const categories = useQuery(trpc.operations.expenseCategories.queryOptions());
	const accounts = useQuery(trpc.operations.financialAccounts.queryOptions());
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
	const update = useMutation(
		trpc.records.update.mutationOptions({
			onSuccess: async (saved) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.records.list.queryKey(),
				});
				onOpenChange(false);
				toast.success(`${saved.title} updated.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	useEffect(() => {
		if (!open) return;
		setType(record?.type ?? "ESTIMATE");
		setTitle(record?.title ?? "");
		setReference(record?.reference ?? "");
		setStatus(record?.status ?? "");
		setAmount(
			record?.amountCents == null ? "" : String(record.amountCents / 100),
		);
		setCompanyId(record?.company?.id ?? "");
		setProjectId(record?.project?.id ?? "");
		setDescription(record?.description ?? "");
		setIncludedInFinancials(record?.includedInFinancials ?? true);
		setBillable(record?.billable ?? false);
		setClientVisible(record?.clientVisible ?? false);
		setExpenseScope(record?.expenseScope ?? "COMPANY");
		setCategoryId(record?.category?.id ?? "");
		setFinancialAccountId(record?.financialAccount?.id ?? "");
	}, [open, record]);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{record ? `Edit ${label(record.type)}` : "Add business record"}
					</DialogTitle>
					<DialogDescription>
						Create a record and optionally link it to a company or project.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const values = {
							type,
							title,
							reference: reference || null,
							status: status || null,
							amountCents: amount ? Math.round(Number(amount) * 100) : null,
							currency: amount ? "JMD" : null,
							companyId: companyId || null,
							projectId: projectId || null,
							description: description || null,
							includedInFinancials,
							billable,
							clientVisible,
							expenseScope: type === "EXPENSE" ? expenseScope : null,
							categoryId: type === "EXPENSE" ? categoryId || null : null,
							financialAccountId:
								type === "EXPENSE" ? financialAccountId || null : null,
						};
						if (record) update.mutate({ id: record.id, ...values });
						else create.mutate(values);
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
						{type === "EXPENSE" ? (
							<>
								<div className="grid grid-cols-2 gap-4">
									<Field>
										<FieldLabel>Category</FieldLabel>
										<Select
											value={categoryId || "none"}
											onValueChange={(value) =>
												setCategoryId(value === "none" ? "" : value)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Uncategorized" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="none">Uncategorized</SelectItem>
													{(categories.data ?? []).map((item) => (
														<SelectItem key={item.id} value={item.id}>
															{item.name}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>
									<Field>
										<FieldLabel>Expense scope</FieldLabel>
										<Select
											value={expenseScope}
											onValueChange={(value) =>
												setExpenseScope(value as typeof expenseScope)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="COMPANY">
														Company / internal
													</SelectItem>
													<SelectItem value="CLIENT">Client</SelectItem>
													<SelectItem value="PROJECT">Project</SelectItem>
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>
								</div>
								<Field>
									<FieldLabel>Paid from</FieldLabel>
									<Select
										value={financialAccountId || "none"}
										onValueChange={(value) =>
											setFinancialAccountId(value === "none" ? "" : value)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="No account assigned" />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												<SelectItem value="none">
													No account assigned
												</SelectItem>
												{(accounts.data ?? []).map((item) => (
													<SelectItem key={item.id} value={item.id}>
														{item.name}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</Field>
								<ToggleField
									label="Include in financial calculations"
									checked={includedInFinancials}
									onChange={setIncludedInFinancials}
								/>
								<ToggleField
									label="Billable to client"
									checked={billable}
									onChange={(value) => {
										setBillable(value);
										if (!value) setClientVisible(false);
									}}
								/>
								<ToggleField
									label="Visible in client portal"
									checked={clientVisible}
									onChange={setClientVisible}
									disabled={!billable}
								/>
							</>
						) : null}
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
						<Button
							type="submit"
							disabled={!title.trim() || create.isPending || update.isPending}
						>
							{record ? "Save changes" : "Create record"}
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

function ToggleField({
	label: text,
	checked,
	onChange,
	disabled = false,
}: {
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex items-center justify-between rounded-lg border p-3 text-sm">
			<span>{text}</span>
			<Switch
				checked={checked}
				onCheckedChange={onChange}
				disabled={disabled}
			/>
		</div>
	);
}
