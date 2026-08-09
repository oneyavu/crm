"use client";

import Add from "@carbon/icons-react/es/Add";
import Download from "@carbon/icons-react/es/Download";
import Edit from "@carbon/icons-react/es/Edit";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Upload from "@carbon/icons-react/es/Upload";
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
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type FormKind =
	| "account"
	| "staff"
	| "category"
	| "template"
	| "document"
	| "compensation"
	| "metric"
	| null;
type PricingRow = {
	id: string;
	name: string;
	costProfile: null | {
		currency: string;
		implementationCostCents: number;
		deliveryCostCents: number;
		monthlyRunCostCents: number;
		monthlyHostingCostCents: number;
		contractorCostCents: number;
		internalHours: number;
		targetMarginPct: number;
		listPriceCents: number;
		notes: string | null;
	};
};

export function OperationsCenter() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const overview = useQuery(
		trpc.operations.overview.queryOptions(undefined, {
			refetchInterval: 30_000,
		}),
	);
	const accounts = useQuery(trpc.operations.financialAccounts.queryOptions());
	const staff = useQuery(trpc.operations.staff.queryOptions());
	const pricing = useQuery(trpc.operations.pricing.queryOptions());
	const categories = useQuery(trpc.operations.expenseCategories.queryOptions());
	const templates = useQuery(trpc.operations.templates.queryOptions());
	const documents = useQuery(trpc.operations.documents.queryOptions());
	const [form, setForm] = useState<FormKind>(null);
	const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
	const [pricingItem, setPricingItem] = useState<PricingRow | null>(null);
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.operations.overview.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.operations.financialAccounts.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.operations.staff.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.operations.pricing.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.operations.expenseCategories.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.operations.templates.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.operations.documents.queryKey(),
			}),
		]);
	const data = overview.data;
	const removeAccount = useMutation(
		trpc.operations.deleteFinancialAccount.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeStaff = useMutation(
		trpc.operations.deleteStaff.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeCategory = useMutation(
		trpc.operations.deleteExpenseCategory.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeTemplate = useMutation(
		trpc.operations.deleteTemplate.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeDocument = useMutation(
		trpc.operations.deleteDocument.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Metric
					label="Invoiced"
					value={formatMoney(data?.invoicedCents ?? 0, "JMD")}
					detail={`${formatMoney(data?.collectedCents ?? 0, "JMD")} collected`}
				/>
				<Metric
					label="Included expenses"
					value={formatMoney(data?.expenseCents ?? 0, "JMD")}
					detail="Excluded expenses do not affect this total"
				/>
				<Metric
					label="Operating margin"
					value={formatMoney(data?.grossMarginCents ?? 0, "JMD")}
					detail="Invoiced less included expenses"
					good={(data?.grossMarginCents ?? 0) >= 0}
				/>
				<Metric
					label="Operations health"
					value={`${data?.openProjects ?? 0} active projects`}
					detail={`${data?.overdueTasks ?? 0} overdue tasks · ${data?.activeStaff ?? 0} staff`}
					good={(data?.overdueTasks ?? 0) === 0}
				/>
			</div>

			<Tabs defaultValue="finance">
				<TabsList className="h-auto flex-wrap justify-start">
					<TabsTrigger value="finance">Finance</TabsTrigger>
					<TabsTrigger value="people">HR & staff</TabsTrigger>
					<TabsTrigger value="pricing">Pricing & costing</TabsTrigger>
					<TabsTrigger value="knowledge">Templates</TabsTrigger>
					<TabsTrigger value="compliance">Business admin</TabsTrigger>
					<TabsTrigger value="deal">Deal calculator</TabsTrigger>
					<TabsTrigger value="forecast">Forecasting</TabsTrigger>
				</TabsList>
				<TabsContent value="finance">
					<Panel
						title="Accounts & payment sources"
						description="Operating, card, merchant, Stripe and cash accounts. Balances are administrative records until a provider connection is configured."
						action={
							<Button onClick={() => setForm("account")}>
								<Add data-icon="inline-start" /> Add account
							</Button>
						}
					>
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{(accounts.data ?? []).map((account) => (
								<div key={account.id} className="rounded-xl border p-4">
									<div className="flex items-start justify-between">
										<div>
											<p className="font-medium">{account.name}</p>
											<p className="text-xs text-muted-foreground">
												{label(account.kind)}
												{account.institution ? ` · ${account.institution}` : ""}
												{account.lastFour ? ` · •••• ${account.lastFour}` : ""}
											</p>
										</div>
										<div className="flex gap-1">
											<Badge variant={account.active ? "default" : "outline"}>
												{account.active ? "Active" : "Inactive"}
											</Badge>
											<IconDelete
												label={`Delete ${account.name}`}
												onClick={() => removeAccount.mutate({ id: account.id })}
											/>
										</div>
									</div>
									<p className="mt-5 text-2xl tabular-nums">
										{formatMoney(account.currentBalanceCents, account.currency)}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Recorded balance
									</p>
								</div>
							))}
						</div>
						<div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
							Stripe is represented as a merchant account and remains inactive
							until Stripe credentials/webhooks are configured. Online invoice
							payment stays disabled; direct transfer remains the live client
							flow.
						</div>
					</Panel>
				</TabsContent>

				<TabsContent value="people">
					<Panel
						title="People operations"
						description="Staff profiles, contracts, auditable earnings/dealsheets, KPIs and deliverables by review period."
						action={
							<Button onClick={() => setForm("staff")}>
								<Add data-icon="inline-start" /> Add staff profile
							</Button>
						}
					>
						<div className="space-y-3">
							{(staff.data ?? []).map((person) => (
								<div key={person.id} className="rounded-xl border p-4">
									<div className="flex flex-wrap items-start gap-3">
										<div>
											<p className="font-medium">{person.name}</p>
											<p className="text-xs text-muted-foreground">
												{person.jobTitle || "Role not set"} ·{" "}
												{person.department || "No department"} · {person.email}
											</p>
										</div>
										<Badge
											className="ml-auto"
											variant={person.active ? "default" : "outline"}
										>
											{person.active ? "Active" : "Inactive"}
										</Badge>
										<IconDelete
											label={`Delete ${person.name}`}
											onClick={() => removeStaff.mutate({ id: person.id })}
										/>
									</div>
									<div className="mt-4 grid gap-3 md:grid-cols-2">
										<div className="rounded-lg bg-muted/40 p-3">
											<p className="text-xs text-muted-foreground">
												Earnings / dealsheet
											</p>
											{person.compensationPlans.length ? (
												person.compensationPlans.map((plan) => (
													<p key={plan.id} className="mt-2 text-sm">
														{plan.name}:{" "}
														{formatMoney(plan.baseAmountCents, plan.currency)}{" "}
														base ·{" "}
														{formatMoney(plan.hourlyRateCents, plan.currency)}
														/hr · {plan.commissionPct}% commission
													</p>
												))
											) : (
												<p className="mt-2 text-sm">
													No compensation plan yet.
												</p>
											)}
										</div>
										<div className="rounded-lg bg-muted/40 p-3">
											<p className="text-xs text-muted-foreground">
												KPIs & deliverables
											</p>
											<p className="mt-2 text-sm">
												{person.metrics.length} tracked items ·{" "}
												{
													person.metrics.filter(
														(item) => item.status === "COMPLETE",
													).length
												}{" "}
												complete
											</p>
										</div>
									</div>
									<div className="mt-3 flex gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => {
												setSelectedStaffId(person.id);
												setForm("compensation");
											}}
										>
											Add earnings plan
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={() => {
												setSelectedStaffId(person.id);
												setForm("metric");
											}}
										>
											Add KPI / deliverable
										</Button>
									</div>
								</div>
							))}
						</div>
					</Panel>
				</TabsContent>

				<TabsContent value="pricing">
					<Panel
						title="Service and product economics"
						description="Editable implementation, delivery, run, hosting, contractor and internal effort costs connected to the VAYU catalog."
					>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-left text-muted-foreground">
										<th className="p-3">Offering</th>
										<th className="p-3 text-right">List price</th>
										<th className="p-3 text-right">Delivery cost</th>
										<th className="p-3 text-right">Monthly run + host</th>
										<th className="p-3 text-right">Target margin</th>
										<th className="p-3">Status</th>
										<th />
									</tr>
								</thead>
								<tbody>
									{(pricing.data ?? []).map((item) => {
										const cost = item.costProfile;
										return (
											<tr key={item.id} className="border-b">
												<td className="p-3">
													<p className="font-medium">{item.name}</p>
													<p className="text-xs text-muted-foreground">
														{item.code} · {item.category}
													</p>
												</td>
												<td className="p-3 text-right">
													{cost
														? formatMoney(cost.listPriceCents, cost.currency)
														: "—"}
												</td>
												<td className="p-3 text-right">
													{cost
														? formatMoney(
																cost.implementationCostCents +
																	cost.deliveryCostCents +
																	cost.contractorCostCents,
																cost.currency,
															)
														: "—"}
												</td>
												<td className="p-3 text-right">
													{cost
														? formatMoney(
																cost.monthlyRunCostCents +
																	cost.monthlyHostingCostCents,
																cost.currency,
															)
														: "—"}
												</td>
												<td className="p-3 text-right">
													{cost ? `${cost.targetMarginPct}%` : "—"}
												</td>
												<td className="p-3">
													<Badge variant={cost ? "default" : "outline"}>
														{cost ? "Costed" : "Needs setup"}
													</Badge>
												</td>
												<td>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => setPricingItem(item)}
													>
														<Edit />
													</Button>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</Panel>
				</TabsContent>

				<TabsContent value="knowledge">
					<div className="grid gap-4 xl:grid-cols-2">
						<Panel
							title="Expense categories"
							description="Imported Perfex categories and new native categories are editable and reusable."
							action={
								<Button size="sm" onClick={() => setForm("category")}>
									<Add /> Add
								</Button>
							}
						>
							<SimpleList
								rows={(categories.data ?? []).map((item) => ({
									id: item.id,
									title: item.name,
									detail:
										item.description ||
										(item.source === "PERFEX"
											? "Imported from Perfex"
											: "Native"),
								}))}
								onDelete={(id) => removeCategory.mutate({ id })}
							/>
						</Panel>
						<Panel
							title="Email templates & suggested replies"
							description="Native editable copies; no production dependency on Perfex."
							action={
								<Button size="sm" onClick={() => setForm("template")}>
									<Add /> Add
								</Button>
							}
						>
							<SimpleList
								rows={(templates.data ?? []).map((item) => ({
									id: item.id,
									title: item.name,
									detail: `${label(item.kind)}${item.category ? ` · ${item.category}` : ""}`,
								}))}
								onDelete={(id) => removeTemplate.mutate({ id })}
							/>
						</Panel>
					</div>
				</TabsContent>

				<TabsContent value="compliance">
					<Panel
						title="Company records & governance files"
						description="Store labelled PDF, Word and text files for filings, tax, ORC, TCC, certificates, licenses, contracts, MSA, stamps, signatures, directors, investors and policies."
						action={
							<Button onClick={() => setForm("document")}>
								<Upload data-icon="inline-start" /> Upload document
							</Button>
						}
					>
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{(documents.data ?? []).map((doc) => (
								<div key={doc.id} className="rounded-xl border p-4">
									<div className="flex items-start justify-between">
										<Badge variant="outline">{label(doc.kind)}</Badge>
										<IconDelete
											label={`Delete ${doc.title}`}
											onClick={() => removeDocument.mutate({ id: doc.id })}
										/>
									</div>
									<p className="mt-3 font-medium">{doc.title}</p>
									<p className="mt-1 truncate text-xs text-muted-foreground">
										{doc.fileName} · {Math.ceil(doc.size / 1024)} KB
									</p>
									<Button asChild className="mt-4" size="sm" variant="outline">
										<a
											href={`/api/operations/documents/${encodeURIComponent(doc.id)}`}
											download={doc.fileName}
										>
											<Download data-icon="inline-start" /> Download
										</a>
									</Button>
								</div>
							))}
						</div>
					</Panel>
				</TabsContent>

				<TabsContent value="deal">
					<DealCalculator />
				</TabsContent>
				<TabsContent value="forecast">
					<ForecastCalculator />
				</TabsContent>
			</Tabs>
			<OperationsForm
				kind={form}
				staffProfileId={selectedStaffId}
				onClose={() => {
					setForm(null);
					setSelectedStaffId(null);
				}}
				onSaved={refresh}
			/>
			<PricingDialog
				item={pricingItem}
				onClose={() => setPricingItem(null)}
				onSaved={refresh}
			/>
		</div>
	);
}

function Metric({
	label: title,
	value,
	detail,
	good,
}: {
	label: string;
	value: string;
	detail: string;
	good?: boolean;
}) {
	return (
		<div className="rounded-xl border bg-card p-4">
			<p className="text-xs text-muted-foreground">{title}</p>
			<p
				className={`mt-3 text-2xl tracking-tight ${good ? "text-emerald-500" : ""}`}
			>
				{value}
			</p>
			<p className="mt-2 text-xs text-muted-foreground">{detail}</p>
		</div>
	);
}
function Panel({
	title,
	description,
	action,
	children,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-xl border bg-card">
			<div className="flex flex-wrap items-start gap-4 border-b p-4">
				<div>
					<h2 className="font-medium">{title}</h2>
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				</div>
				{action ? <div className="ml-auto">{action}</div> : null}
			</div>
			<div className="p-4">{children}</div>
		</section>
	);
}
function SimpleList({
	rows,
	onDelete,
}: {
	rows: Array<{ id: string; title: string; detail: string }>;
	onDelete?: (id: string) => void;
}) {
	return (
		<div className="divide-y rounded-lg border">
			{rows.map((row) => (
				<div key={row.id} className="flex items-center gap-3 p-3">
					<div>
						<p className="text-sm font-medium">{row.title}</p>
						<p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
					</div>
					{onDelete ? (
						<div className="ml-auto">
							<IconDelete
								label={`Delete ${row.title}`}
								onClick={() => onDelete(row.id)}
							/>
						</div>
					) : null}
				</div>
			))}
		</div>
	);
}
function IconDelete({
	label: text,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<Button size="icon-sm" variant="ghost" aria-label={text} onClick={onClick}>
			<TrashCan />
		</Button>
	);
}
function label(value: string) {
	return value
		.toLowerCase()
		.replaceAll("_", " ")
		.replace(/^./, (c) => c.toUpperCase());
}

function OperationsForm({
	kind,
	staffProfileId,
	onClose,
	onSaved,
}: {
	kind: FormKind;
	staffProfileId: string | null;
	onClose: () => void;
	onSaved: () => Promise<unknown>;
}) {
	const trpc = useTRPC();
	const [values, setValues] = useState<Record<string, string>>({});
	const [file, setFile] = useState<File | null>(null);
	const account = useMutation(
		trpc.operations.saveFinancialAccount.mutationOptions(),
	);
	const staff = useMutation(trpc.operations.saveStaff.mutationOptions());
	const category = useMutation(
		trpc.operations.saveExpenseCategory.mutationOptions(),
	);
	const template = useMutation(trpc.operations.saveTemplate.mutationOptions());
	const compensation = useMutation(
		trpc.operations.saveCompensation.mutationOptions(),
	);
	const metric = useMutation(trpc.operations.saveMetric.mutationOptions());
	const document = useMutation(trpc.operations.saveDocument.mutationOptions());
	const mutation = useMutation({
		mutationFn: async () => {
			switch (kind) {
				case "account":
					return account.mutateAsync({
						name: values.name || "",
						kind: (values.kind || "OPERATING") as "OPERATING",
						institution: values.institution || null,
						currency: (values.currency || "JMD").toUpperCase(),
						lastFour: values.lastFour || null,
						openingBalanceCents: cents(values.openingBalance),
						currentBalanceCents: cents(values.currentBalance),
						active: true,
						notes: values.notes || null,
					});
				case "staff":
					return staff.mutateAsync({
						name: values.name || "",
						email: values.email || "",
						jobTitle: values.jobTitle || null,
						department: values.department || null,
						employmentType: values.employmentType || null,
						active: true,
						startDate: values.startDate || null,
						endDate: null,
						contractSummary: values.contractSummary || null,
						userId: null,
					});
				case "category":
					return category.mutateAsync({
						name: values.name || "",
						description: values.description || null,
						active: true,
					});
				case "template":
					return template.mutateAsync({
						kind: (values.templateKind || "EMAIL") as "EMAIL",
						name: values.name || "",
						subject: values.subject || null,
						body: values.body || "",
						category: values.category || null,
						active: true,
					});
				case "compensation":
					return compensation.mutateAsync({
						staffProfileId: staffProfileId || "",
						name: values.name || "Earnings plan",
						currency: values.currency || "JMD",
						baseAmountCents: cents(values.baseAmount),
						hourlyRateCents: cents(values.hourlyRate),
						commissionPct: Number(values.commissionPct || 0),
						bonusFormula: values.bonusFormula || null,
						effectiveFrom: values.effectiveFrom || new Date().toISOString(),
						effectiveTo: null,
						active: true,
					});
				case "metric":
					return metric.mutateAsync({
						staffProfileId: staffProfileId || "",
						period: (values.period || "MONTHLY") as "MONTHLY",
						kind: values.metricKind || "KPI",
						title: values.title || "",
						target: values.target ? Number(values.target) : null,
						actual: values.actual ? Number(values.actual) : null,
						unit: values.unit || null,
						periodStart: values.periodStart || new Date().toISOString(),
						periodEnd: values.periodEnd || new Date().toISOString(),
						status: values.status || "OPEN",
						notes: values.notes || null,
					});
				case "document":
					if (file)
						return document.mutateAsync({
							kind: (values.documentKind || "OTHER") as "OTHER",
							title: values.title || file.name,
							label: values.label || null,
							description: values.description || null,
							projectId: null,
							fileName: file.name,
							mediaType: file.type || "application/octet-stream",
							contentBase64: await fileBase64(file),
							expiresAt: values.expiresAt || null,
						});
					throw new Error("Choose a document first.");
				default:
					throw new Error("No form selected.");
			}
		},
		onSuccess: async () => {
			await onSaved();
			setValues({});
			setFile(null);
			onClose();
			toast.success("Saved permanently.");
		},
		onError: (error) => toast.error(error.message),
	});
	if (!kind) return null;
	const set =
		(name: string) =>
		(
			event: React.ChangeEvent<
				HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
			>,
		) =>
			setValues((current) => ({ ...current, [name]: event.target.value }));
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{label(kind)}</DialogTitle>
					<DialogDescription>
						Fields can be updated later by an administrator; changes are
						recorded in the audit trail.
					</DialogDescription>
				</DialogHeader>
				<div className="grid max-h-[60vh] gap-3 overflow-y-auto py-2">
					{kind === "account" ? (
						<>
							<Field label="Account name">
								<Input onChange={set("name")} />
							</Field>
							<Field label="Type">
								<SelectInput
									value={values.kind || "OPERATING"}
									onChange={set("kind")}
									options={[
										"OPERATING",
										"SAVINGS",
										"CREDIT_CARD",
										"MERCHANT",
										"STRIPE",
										"CASH",
										"OTHER",
									]}
								/>
							</Field>
							<Field label="Institution">
								<Input onChange={set("institution")} />
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Currency">
									<Input defaultValue="JMD" onChange={set("currency")} />
								</Field>
								<Field label="Last four">
									<Input maxLength={4} onChange={set("lastFour")} />
								</Field>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Opening balance">
									<Input inputMode="decimal" onChange={set("openingBalance")} />
								</Field>
								<Field label="Current balance">
									<Input inputMode="decimal" onChange={set("currentBalance")} />
								</Field>
							</div>
						</>
					) : null}
					{kind === "staff" ? (
						<>
							<Field label="Full name">
								<Input onChange={set("name")} />
							</Field>
							<Field label="Email">
								<Input type="email" onChange={set("email")} />
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Job title">
									<Input onChange={set("jobTitle")} />
								</Field>
								<Field label="Department">
									<Input onChange={set("department")} />
								</Field>
							</div>
							<Field label="Employment type">
								<Input
									placeholder="Employee, contractor…"
									onChange={set("employmentType")}
								/>
							</Field>
							<Field label="Start date">
								<Input type="date" onChange={set("startDate")} />
							</Field>
							<Field label="Contract summary">
								<Textarea onChange={set("contractSummary")} />
							</Field>
						</>
					) : null}
					{kind === "category" ? (
						<>
							<Field label="Category name">
								<Input onChange={set("name")} />
							</Field>
							<Field label="Description">
								<Textarea onChange={set("description")} />
							</Field>
						</>
					) : null}
					{kind === "template" ? (
						<>
							<Field label="Template type">
								<SelectInput
									value={values.templateKind || "EMAIL"}
									onChange={set("templateKind")}
									options={["EMAIL", "SUGGESTED_REPLY"]}
								/>
							</Field>
							<Field label="Name">
								<Input onChange={set("name")} />
							</Field>
							<Field label="Category">
								<Input onChange={set("category")} />
							</Field>
							<Field label="Subject">
								<Input onChange={set("subject")} />
							</Field>
							<Field label="Body">
								<Textarea rows={8} onChange={set("body")} />
							</Field>
						</>
					) : null}
					{kind === "compensation" ? (
						<>
							<Field label="Plan name">
								<Input placeholder="Base + commission" onChange={set("name")} />
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Currency">
									<Input defaultValue="JMD" onChange={set("currency")} />
								</Field>
								<Field label="Effective from">
									<Input type="date" onChange={set("effectiveFrom")} />
								</Field>
							</div>
							<div className="grid grid-cols-3 gap-3">
								<Field label="Base amount">
									<Input inputMode="decimal" onChange={set("baseAmount")} />
								</Field>
								<Field label="Hourly rate">
									<Input inputMode="decimal" onChange={set("hourlyRate")} />
								</Field>
								<Field label="Commission %">
									<Input inputMode="decimal" onChange={set("commissionPct")} />
								</Field>
							</div>
							<Field label="Bonus / dealsheet formula">
								<Textarea
									placeholder="Describe exactly when and how variable earnings are calculated…"
									onChange={set("bonusFormula")}
								/>
							</Field>
						</>
					) : null}
					{kind === "metric" ? (
						<>
							<Field label="KPI / deliverable">
								<Input onChange={set("title")} />
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Kind">
									<SelectInput
										value={values.metricKind || "KPI"}
										onChange={set("metricKind")}
										options={["KPI", "DELIVERABLE"]}
									/>
								</Field>
								<Field label="Period">
									<SelectInput
										value={values.period || "MONTHLY"}
										onChange={set("period")}
										options={[
											"DAILY",
											"WEEKLY",
											"MONTHLY",
											"QUARTERLY",
											"SEMIANNUAL",
											"ANNUAL",
										]}
									/>
								</Field>
							</div>
							<div className="grid grid-cols-3 gap-3">
								<Field label="Target">
									<Input inputMode="decimal" onChange={set("target")} />
								</Field>
								<Field label="Actual">
									<Input inputMode="decimal" onChange={set("actual")} />
								</Field>
								<Field label="Unit">
									<Input onChange={set("unit")} />
								</Field>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Period start">
									<Input type="date" onChange={set("periodStart")} />
								</Field>
								<Field label="Period end">
									<Input type="date" onChange={set("periodEnd")} />
								</Field>
							</div>
						</>
					) : null}
					{kind === "document" ? (
						<>
							<Field label="Document type">
								<SelectInput
									value={values.documentKind || "OTHER"}
									onChange={set("documentKind")}
									options={[
										"ANNUAL_FILING",
										"TAX",
										"ORC",
										"TCC",
										"CERTIFICATE",
										"LICENSE",
										"CONTRACT",
										"MSA",
										"COMPANY_STAMP",
										"AUTHORIZED_SIGNATURE",
										"DIRECTOR_RECORD",
										"INVESTOR_AGREEMENT",
										"POLICY",
										"OTHER",
									]}
								/>
							</Field>
							<Field label="Title">
								<Input onChange={set("title")} />
							</Field>
							<Field label="Label">
								<Input onChange={set("label")} />
							</Field>
							<Field label="File (PDF, Word or text; max 10 MB)">
								<Input
									type="file"
									accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain"
									onChange={(event) => setFile(event.target.files?.[0] ?? null)}
								/>
							</Field>
							<Field label="Expiry / renewal date">
								<Input type="date" onChange={set("expiresAt")} />
							</Field>
							<Field label="Description">
								<Textarea onChange={set("description")} />
							</Field>
						</>
					) : null}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending}
					>
						Save record
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DealCalculator() {
	const trpc = useTRPC();
	const [prompt, setPrompt] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [analysis, setAnalysis] = useState("");
	const analyze = useMutation(
		trpc.operations.analyzeDeal.mutationOptions({
			onSuccess: (result) => {
				setAnalysis(result.analysis);
				toast.success("Analysis saved to CRM notes.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<Panel
			title="AI deal calculator"
			description="Upload a proposal or discovery document. The assistant maps requirements to the live catalog/cost profiles and audits the result as a CRM note."
		>
			<div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
				<div className="space-y-3">
					<Textarea
						rows={10}
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder="Describe the prospect, goals, constraints and commercial context…"
					/>
					<Input
						type="file"
						multiple
						accept=".pdf,.doc,.docx,.txt"
						onChange={(event) =>
							setFiles(Array.from(event.target.files ?? []).slice(0, 5))
						}
					/>
					<div className="text-xs text-muted-foreground">
						{files.length
							? files.map((file) => file.name).join(" · ")
							: "Up to 5 files, 10 MB each."}
					</div>
					<Button
						disabled={!prompt.trim() || analyze.isPending}
						onClick={async () =>
							analyze.mutate({
								prompt,
								companyId: null,
								projectId: null,
								files: await Promise.all(
									files.map(async (file) => ({
										name: file.name,
										mediaType: file.type || "application/octet-stream",
										contentBase64: await fileBase64(file),
									})),
								),
							})
						}
					>
						{analyze.isPending ? "Analyzing…" : "Analyze opportunity"}
					</Button>
				</div>
				<div className="min-h-80 rounded-xl border bg-muted/20 p-5">
					<p className="text-xs font-medium text-emerald-500">
						VAYU DEAL REVIEW
					</p>
					<div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
						{analysis ||
							"The fit score, mapped services, gaps, strengths, risks, outsourcing comparison and recommendation will appear here."}
					</div>
				</div>
			</div>
		</Panel>
	);
}

function ForecastCalculator() {
	const trpc = useTRPC();
	const [values, setValues] = useState({
		months: "12", monthlyLeads: "20", conversionPct: "15",
		averageDeal: "250000", grossMarginPct: "45", monthlyGrowthPct: "5",
		monthlyChurnPct: "2", acquisitionCost: "25000",
		fixedOperatingCost: "500000", payrollCost: "1000000", cashOnHand: "0",
	});
	const [result, setResult] = useState<Awaited<ReturnType<typeof forecastPlaceholder>> | null>(null);
	const forecast = useMutation(
		trpc.operations.forecast.mutationOptions({
			onSuccess: (data) => setResult(data as never),
			onError: (error) => toast.error(error.message),
		}),
	);
	const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
		setValues((current) => ({ ...current, [key]: event.target.value }));
	const money = (value: string) => Math.round((Number(value) || 0) * 100);
	return (
		<Panel title="Financial forecasting & business optimization" description="Admin-only deterministic projections. Calculations run in code rather than consuming AI tokens.">
			<div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
				<div className="grid grid-cols-2 gap-3">
					{([
						["months", "Forecast months"], ["monthlyLeads", "Monthly leads"],
						["conversionPct", "Conversion %"], ["averageDeal", "Average deal (JMD)"],
						["grossMarginPct", "Gross margin %"], ["monthlyGrowthPct", "Monthly growth %"],
						["monthlyChurnPct", "Monthly churn %"], ["acquisitionCost", "CAC per client (JMD)"],
						["fixedOperatingCost", "Fixed monthly cost (JMD)"], ["payrollCost", "Monthly payroll (JMD)"],
						["cashOnHand", "Cash on hand (JMD)"],
					] as Array<[keyof typeof values, string]>).map(([key, title]) => (
						<Field key={key} label={title}><Input inputMode="decimal" value={values[key]} onChange={set(key)} /></Field>
					))}
					<Button className="col-span-2" disabled={forecast.isPending} onClick={() => forecast.mutate({
						months: Math.max(1, Math.round(Number(values.months) || 12)),
						monthlyLeads: Number(values.monthlyLeads) || 0,
						conversionPct: Number(values.conversionPct) || 0,
						averageDealCents: money(values.averageDeal), grossMarginPct: Number(values.grossMarginPct) || 0,
						monthlyGrowthPct: Number(values.monthlyGrowthPct) || 0, monthlyChurnPct: Number(values.monthlyChurnPct) || 0,
						acquisitionCostCents: money(values.acquisitionCost), fixedOperatingCostCents: money(values.fixedOperatingCost),
						payrollCostCents: money(values.payrollCost), cashOnHandCents: money(values.cashOnHand),
					})}>{forecast.isPending ? "Calculating…" : "Run forecast"}</Button>
				</div>
				<div className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<Metric label="Projected revenue" value={formatMoney(result?.summary.projectedRevenueCents ?? 0, "JMD")} detail="Across the selected forecast horizon" />
						<Metric label="Projected profit" value={formatMoney(result?.summary.projectedProfitCents ?? 0, "JMD")} detail="After delivery, acquisition and operating costs" good={(result?.summary.projectedProfitCents ?? 0) >= 0} />
						<Metric label="Ending cash" value={formatMoney(result?.summary.endingCashCents ?? 0, "JMD")} detail="Projected closing cash position" good={(result?.summary.endingCashCents ?? 0) >= 0} />
						<Metric label="Break-even" value={result?.summary.breakEvenMonth ? `Month ${result.summary.breakEvenMonth}` : "Not reached"} detail={result?.summary.cacPaybackMonths == null ? "CAC payback unavailable" : `${result.summary.cacPaybackMonths} month CAC payback`} />
					</div>
					<div className="max-h-96 overflow-auto rounded-xl border"><table className="w-full text-xs"><thead><tr className="border-b"><th className="p-2 text-left">Month</th><th>Revenue</th><th>Profit</th><th>Cash</th></tr></thead><tbody>{(result?.monthly ?? []).map((row) => <tr key={row.month} className="border-b"><td className="p-2">{row.month}</td><td className="text-right">{formatMoney(row.revenueCents,"JMD")}</td><td className="text-right">{formatMoney(row.profitCents,"JMD")}</td><td className="pr-2 text-right">{formatMoney(row.cashCents,"JMD")}</td></tr>)}</tbody></table></div>
				</div>
			</div>
		</Panel>
	);
}

async function forecastPlaceholder() {
	return { summary: { projectedRevenueCents: 0, projectedProfitCents: 0, endingCashCents: 0, breakEvenMonth: null as number | null, cacPaybackMonths: null as number | null }, monthly: [] as Array<{ month: number; revenueCents: number; profitCents: number; cashCents: number }> };
}

function PricingDialog({
	item,
	onClose,
	onSaved,
}: {
	item: PricingRow | null;
	onClose: () => void;
	onSaved: () => Promise<unknown>;
}) {
	const trpc = useTRPC();
	const [values, setValues] = useState<Record<string, string>>({});
	useEffect(() => {
		if (!item) return;
		const cost = item.costProfile;
		setValues({
			currency: cost?.currency ?? "JMD",
			implementation: String((cost?.implementationCostCents ?? 0) / 100),
			delivery: String((cost?.deliveryCostCents ?? 0) / 100),
			run: String((cost?.monthlyRunCostCents ?? 0) / 100),
			hosting: String((cost?.monthlyHostingCostCents ?? 0) / 100),
			contractor: String((cost?.contractorCostCents ?? 0) / 100),
			hours: String(cost?.internalHours ?? 0),
			margin: String(cost?.targetMarginPct ?? 35),
			price: String((cost?.listPriceCents ?? 0) / 100),
			notes: cost?.notes ?? "",
		});
	}, [item]);
	const save = useMutation(
		trpc.operations.savePricing.mutationOptions({
			onSuccess: async () => {
				await onSaved();
				onClose();
				toast.success("Cost profile saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	if (!item) return null;
	const set =
		(key: string) =>
		(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			setValues((current) => ({ ...current, [key]: event.target.value }));
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Costing · {item.name}</DialogTitle>
					<DialogDescription>
						These values drive service economics and deal analysis. They are
						administrative planning figures, not ledger entries.
					</DialogDescription>
				</DialogHeader>
				<div className="grid max-h-[60vh] gap-3 overflow-y-auto">
					<Field label="Currency">
						<Input
							value={values.currency ?? "JMD"}
							onChange={set("currency")}
						/>
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Implementation cost">
							<Input
								inputMode="decimal"
								value={values.implementation ?? ""}
								onChange={set("implementation")}
							/>
						</Field>
						<Field label="Delivery cost">
							<Input
								inputMode="decimal"
								value={values.delivery ?? ""}
								onChange={set("delivery")}
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Monthly run cost">
							<Input
								inputMode="decimal"
								value={values.run ?? ""}
								onChange={set("run")}
							/>
						</Field>
						<Field label="Monthly hosting cost">
							<Input
								inputMode="decimal"
								value={values.hosting ?? ""}
								onChange={set("hosting")}
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Contractor cost">
							<Input
								inputMode="decimal"
								value={values.contractor ?? ""}
								onChange={set("contractor")}
							/>
						</Field>
						<Field label="Internal hours">
							<Input
								inputMode="decimal"
								value={values.hours ?? ""}
								onChange={set("hours")}
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Target margin %">
							<Input
								inputMode="decimal"
								value={values.margin ?? ""}
								onChange={set("margin")}
							/>
						</Field>
						<Field label="List price">
							<Input
								inputMode="decimal"
								value={values.price ?? ""}
								onChange={set("price")}
							/>
						</Field>
					</div>
					<Field label="Costing notes">
						<Textarea value={values.notes ?? ""} onChange={set("notes")} />
					</Field>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={save.isPending}
						onClick={() =>
							save.mutate({
								catalogItemId: item.id,
								currency: (values.currency || "JMD").toUpperCase(),
								implementationCostCents: cents(values.implementation),
								deliveryCostCents: cents(values.delivery),
								monthlyRunCostCents: cents(values.run),
								monthlyHostingCostCents: cents(values.hosting),
								contractorCostCents: cents(values.contractor),
								internalHours: Number(values.hours || 0),
								targetMarginPct: Number(values.margin || 0),
								listPriceCents: cents(values.price),
								notes: values.notes || null,
							})
						}
					>
						Save costing
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
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
function SelectInput({
	value,
	onChange,
	options,
}: {
	value: string;
	onChange: React.ChangeEventHandler<HTMLSelectElement>;
	options: string[];
}) {
	return (
		<select
			className="h-9 rounded-md border bg-background px-3 text-sm"
			value={value}
			onChange={onChange}
		>
			{options.map((option) => (
				<option key={option} value={option}>
					{label(option)}
				</option>
			))}
		</select>
	);
}
function cents(value?: string) {
	return Math.round(Number(value || 0) * 100);
}
async function fileBase64(file: File) {
	const data = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (let i = 0; i < data.length; i += 0x8000)
		binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
	return btoa(binary);
}
