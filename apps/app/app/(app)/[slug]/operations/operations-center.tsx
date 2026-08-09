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
import { useEffect, useMemo, useState } from "react";
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
		baseCostCents: number;
		pricingUnit: string;
		implementationCostCents: number;
		deliveryCostCents: number;
		monthlyRunCostCents: number;
		monthlyHostingCostCents: number;
		contractorCostCents: number;
		internalHours: number;
		targetMarginPct: number;
		listPriceCents: number;
		notes: string | null;
		criteria: Array<{
			id: string;
			name: string;
			kind: string;
			unitLabel: string;
			defaultQuantity: number;
			unitCostCents: number;
			percentage: number;
			required: boolean;
			active: boolean;
		}>;
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
										<th className="p-3 text-right">Base cost</th>
										<th className="p-3 text-right">Delivery cost</th>
										<th className="p-3 text-right">Monthly run + host</th>
										<th className="p-3 text-right">Target margin</th>
										<th className="p-3 text-right">Criteria</th>
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
														? formatMoney(cost.baseCostCents, cost.currency)
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
												<td className="p-3 text-right">
													{cost?.criteria.filter((entry) => entry.active)
														.length ?? 0}
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
	const queryClient = useQueryClient();
	const pricing = useQuery(trpc.operations.pricing.queryOptions());
	const savedSheets = useQuery(trpc.operations.dealSheets.queryOptions());
	const [sheetId, setSheetId] = useState<string | undefined>();
	const [title, setTitle] = useState("New opportunity");
	const [currency, setCurrency] = useState("JMD");
	const [marketRegion, setMarketRegion] = useState("Jamaica");
	const [margin, setMargin] = useState("35");
	const [contingency, setContingency] = useState("5");
	const [discount, setDiscount] = useState("0");
	const [tax, setTax] = useState("0");
	const [lines, setLines] = useState<
		Array<{
			key: string;
			catalogItemId: string;
			description: string;
			quantity: string;
			unit: string;
			baseCost: string;
			criteriaCost: string;
			suggestedPrice: string;
			marketLow: string;
			marketMedian: string;
			marketHigh: string;
			researchRationale: string;
			criteriaSnapshot: Array<{
				key: string;
				name: string;
				kind: string;
				quantity: number;
				unitCostCents: number;
				percentage: number;
				amountCents: number;
			}>;
		}>
	>([]);
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
	const totals = useMemo(() => {
		const directCost = lines.reduce(
			(sum, line) =>
				sum +
				(Number(line.baseCost) + Number(line.criteriaCost)) *
					Number(line.quantity || 0),
			0,
		);
		const contingencyAmount = directCost * (Number(contingency || 0) / 100);
		const marginRate = Math.min(95, Number(margin || 0)) / 100;
		const marginPrice = (directCost + contingencyAmount) / (1 - marginRate);
		const proposedPrice = lines.reduce(
			(sum, line) =>
				sum + Number(line.suggestedPrice || 0) * Number(line.quantity || 0),
			0,
		);
		const targetPrice = Math.max(marginPrice, proposedPrice);
		const discountAmount = targetPrice * (Number(discount || 0) / 100);
		const subtotal = targetPrice - discountAmount;
		const taxAmount = subtotal * (Number(tax || 0) / 100);
		return {
			directCost,
			contingencyAmount,
			targetPrice,
			discountAmount,
			subtotal,
			taxAmount,
			finalTotal: subtotal + taxAmount,
		};
	}, [contingency, discount, lines, margin, tax]);
	const research = useMutation(
		trpc.operations.researchMarket.mutationOptions({
			onSuccess: (result) => {
				setLines((current) =>
					current.map((line, index) => {
						const found = result.lines.find((entry) => entry.index === index);
						return found
							? {
									...line,
									marketLow: found.low == null ? "" : String(found.low),
									marketMedian:
										found.median == null ? "" : String(found.median),
									marketHigh: found.high == null ? "" : String(found.high),
									researchRationale: found.rationale,
								}
							: line;
					}),
				);
				toast.success(
					`Market research complete with ${result.sources.length} cited sources.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const save = useMutation(
		trpc.operations.saveDealSheet.mutationOptions({
			onSuccess: async (result) => {
				setSheetId(result.id);
				await queryClient.invalidateQueries({
					queryKey: trpc.operations.dealSheets.queryKey(),
				});
				toast.success(`Deal sheet ${result.reference} saved.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const addOffering = (catalogItemId: string) => {
		const item = (pricing.data ?? []).find(
			(entry) => entry.id === catalogItemId,
		);
		if (!item) return;
		const profile = item.costProfile;
		const base = (profile?.baseCostCents ?? 0) / 100;
		const criteriaSnapshot = (profile?.criteria ?? [])
			.filter((criterion) => criterion.active)
			.map((criterion) => {
				const amountCents =
					criterion.kind === "PERCENTAGE"
						? Math.round(
								((profile?.baseCostCents ?? 0) * criterion.percentage) / 100,
							)
						: criterion.kind === "FIXED"
							? criterion.unitCostCents
							: Math.round(criterion.unitCostCents * criterion.defaultQuantity);
				return {
					key: criterion.id,
					name: criterion.name,
					kind: criterion.kind,
					quantity: criterion.defaultQuantity,
					unitCostCents: criterion.unitCostCents,
					percentage: criterion.percentage,
					amountCents,
				};
			});
		const criteriaTotal =
			criteriaSnapshot.reduce(
				(sum, criterion) => sum + criterion.amountCents,
				0,
			) / 100;
		setCurrency(profile?.currency ?? currency);
		setLines((current) => [
			...current,
			{
				key: crypto.randomUUID(),
				catalogItemId: item.id,
				description: item.name,
				quantity: "1",
				unit: profile?.pricingUnit ?? "engagement",
				baseCost: String(base),
				criteriaCost: String(criteriaTotal),
				suggestedPrice: String((profile?.listPriceCents ?? 0) / 100),
				marketLow: "",
				marketMedian: "",
				marketHigh: "",
				researchRationale: "",
				criteriaSnapshot,
			},
		]);
	};
	const payloadLines = () =>
		lines.map(({ key: _key, ...line }) => ({
			catalogItemId: line.catalogItemId || null,
			description: line.description,
			quantity: Number(line.quantity || 0),
			unit: line.unit,
			baseCostCents: cents(line.baseCost),
			criteriaCostCents: cents(line.criteriaCost),
			suggestedPriceCents: cents(line.suggestedPrice),
			marketLowCents: line.marketLow ? cents(line.marketLow) : null,
			marketMedianCents: line.marketMedian ? cents(line.marketMedian) : null,
			marketHighCents: line.marketHigh ? cents(line.marketHigh) : null,
			criteriaSnapshot: line.criteriaSnapshot.map(
				({ key: _key, ...criterion }) => criterion,
			),
			researchRationale: line.researchRationale || null,
		}));
	return (
		<div className="space-y-4">
			<Panel
				title="Commercial deal sheet"
				description="Auditable cost build-up, margin pricing and cited market guidance. AI suggestions never change a price until you apply and save them."
			>
				<div className="grid gap-3 md:grid-cols-4">
					<Field label="Deal title">
						<Input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
						/>
					</Field>
					<Field label="Currency">
						<Input
							value={currency}
							onChange={(event) =>
								setCurrency(event.target.value.toUpperCase())
							}
						/>
					</Field>
					<Field label="Market / region">
						<Input
							value={marketRegion}
							onChange={(event) => setMarketRegion(event.target.value)}
						/>
					</Field>
					<Field label="Add catalog offering">
						<select
							className="h-9 rounded-md border bg-background px-3 text-sm"
							defaultValue=""
							onChange={(event) => {
								addOffering(event.target.value);
								event.target.value = "";
							}}
						>
							<option value="">Select…</option>
							{(pricing.data ?? []).map((item) => (
								<option key={item.id} value={item.id}>
									{item.name}
								</option>
							))}
						</select>
					</Field>
				</div>
				<div className="mt-4 overflow-x-auto rounded-xl border">
					<table className="w-full min-w-[1100px] text-xs">
						<thead>
							<tr className="border-b bg-muted/30 text-left">
								<th className="p-2">Offering</th>
								<th className="p-2">Qty</th>
								<th className="p-2">Unit</th>
								<th className="p-2 text-right">Base cost</th>
								<th className="p-2 text-right">Criteria</th>
								<th className="p-2 text-right">Proposed / unit</th>
								<th className="p-2 text-right">Market low</th>
								<th className="p-2 text-right">Median</th>
								<th className="p-2 text-right">High</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{lines.map((line, index) => {
								const update = (key: keyof typeof line, value: string) =>
									setLines((current) =>
										current.map((entry, entryIndex) =>
											entryIndex === index ? { ...entry, [key]: value } : entry,
										),
									);
								return (
									<tr key={line.key} className="border-b align-top">
										<td className="p-2">
											<Input
												value={line.description}
												onChange={(event) =>
													update("description", event.target.value)
												}
											/>
											<div className="mt-1 max-w-80 space-y-1 text-[10px] text-muted-foreground">
												{line.criteriaSnapshot.length
													? line.criteriaSnapshot.map(
															(entry, criterionIndex) => (
																<div
																	key={entry.key}
																	className="flex items-center gap-1"
																>
																	<span className="min-w-24 truncate">
																		{entry.name}
																	</span>
																	{entry.kind === "PER_UNIT" ? (
																		<Input
																			aria-label={`${entry.name} quantity`}
																			className="h-6 w-16 px-1 text-[10px]"
																			inputMode="decimal"
																			value={entry.quantity}
																			onChange={(event) => {
																				const quantity = Number(
																					event.target.value || 0,
																				);
																				setLines((current) =>
																					current.map(
																						(currentLine, lineIndex) => {
																							if (lineIndex !== index)
																								return currentLine;
																							const next =
																								currentLine.criteriaSnapshot.map(
																									(
																										currentCriterion,
																										currentIndex,
																									) =>
																										currentIndex ===
																										criterionIndex
																											? {
																													...currentCriterion,
																													quantity,
																													amountCents:
																														Math.round(
																															currentCriterion.unitCostCents *
																																quantity,
																														),
																												}
																											: currentCriterion,
																								);
																							return {
																								...currentLine,
																								criteriaSnapshot: next,
																								criteriaCost: String(
																									next.reduce(
																										(sum, criterion) =>
																											sum +
																											criterion.amountCents,
																										0,
																									) / 100,
																								),
																							};
																						},
																					),
																				);
																			}}
																		/>
																	) : null}
																	<span>
																		{formatMoney(entry.amountCents, currency)}
																	</span>
																</div>
															),
														)
													: "No criteria applied"}
											</div>
										</td>
										<td className="p-2">
											<Input
												className="w-20"
												inputMode="decimal"
												value={line.quantity}
												onChange={(event) =>
													update("quantity", event.target.value)
												}
											/>
										</td>
										<td className="p-2">
											<Input
												className="w-28"
												value={line.unit}
												onChange={(event) => update("unit", event.target.value)}
											/>
										</td>
										{(
											[
												"baseCost",
												"criteriaCost",
												"suggestedPrice",
												"marketLow",
												"marketMedian",
												"marketHigh",
											] as const
										).map((key) => (
											<td key={key} className="p-2">
												<Input
													className="w-28 text-right"
													inputMode="decimal"
													value={line[key]}
													onChange={(event) => update(key, event.target.value)}
												/>
											</td>
										))}
										<td className="p-2">
											<IconDelete
												label={`Delete ${line.description}`}
												onClick={() =>
													setLines((current) =>
														current.filter(
															(_, entryIndex) => entryIndex !== index,
														),
													)
												}
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{!lines.length ? (
						<p className="p-8 text-center text-sm text-muted-foreground">
							Add an offering to begin the cost build-up.
						</p>
					) : null}
				</div>
				<div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<Field label="Margin %">
							<Input
								inputMode="decimal"
								value={margin}
								onChange={(event) => setMargin(event.target.value)}
							/>
						</Field>
						<Field label="Contingency %">
							<Input
								inputMode="decimal"
								value={contingency}
								onChange={(event) => setContingency(event.target.value)}
							/>
						</Field>
						<Field label="Discount %">
							<Input
								inputMode="decimal"
								value={discount}
								onChange={(event) => setDiscount(event.target.value)}
							/>
						</Field>
						<Field label="Tax %">
							<Input
								inputMode="decimal"
								value={tax}
								onChange={(event) => setTax(event.target.value)}
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-4 text-sm">
						<span className="text-muted-foreground">Direct cost</span>
						<span className="text-right">
							{formatMoney(Math.round(totals.directCost * 100), currency)}
						</span>
						<span className="text-muted-foreground">Contingency</span>
						<span className="text-right">
							{formatMoney(
								Math.round(totals.contingencyAmount * 100),
								currency,
							)}
						</span>
						<span className="text-muted-foreground">Margin target</span>
						<span className="text-right">
							{formatMoney(Math.round(totals.targetPrice * 100), currency)}
						</span>
						<span className="text-muted-foreground">Discount</span>
						<span className="text-right">
							− {formatMoney(Math.round(totals.discountAmount * 100), currency)}
						</span>
						<span className="text-muted-foreground">Tax</span>
						<span className="text-right">
							{formatMoney(Math.round(totals.taxAmount * 100), currency)}
						</span>
						<strong>Final cost</strong>
						<strong className="text-right text-emerald-500">
							{formatMoney(Math.round(totals.finalTotal * 100), currency)}
						</strong>
					</div>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<Button
						variant="outline"
						disabled={!lines.length || research.isPending}
						onClick={() =>
							research.mutate({
								currency,
								marketRegion,
								lines: payloadLines().map(
									({
										suggestedPriceCents: _suggested,
										marketLowCents: _low,
										marketMedianCents: _median,
										marketHighCents: _high,
										criteriaSnapshot: _criteria,
										researchRationale: _rationale,
										...line
									}) => line,
								),
							})
						}
					>
						{research.isPending ? "Researching…" : "Research market value"}
					</Button>
					<Button
						disabled={!lines.length || save.isPending}
						onClick={() =>
							save.mutate({
								id: sheetId,
								title,
								status: "DRAFT",
								currency,
								marketRegion,
								companyId: null,
								projectId: null,
								contingencyPct: Number(contingency || 0),
								discountPct: Number(discount || 0),
								taxPct: Number(tax || 0),
								targetMarginPct: Number(margin || 0),
								notes: null,
								lines: payloadLines(),
							})
						}
					>
						{save.isPending ? "Saving…" : "Save deal sheet"}
					</Button>
				</div>
				{research.data ? (
					<div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
						<p className="text-sm font-medium">Market research</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{research.data.summary}
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{research.data.sources.map((source) => (
								<a
									key={source.url}
									className="text-xs text-emerald-500 underline"
									href={source.url}
									target="_blank"
									rel="noreferrer"
								>
									{source.title}
								</a>
							))}
						</div>
					</div>
				) : null}
				{(savedSheets.data ?? []).length ? (
					<div className="mt-4 border-t pt-3">
						<p className="text-xs font-medium text-muted-foreground">
							RECENT DEAL SHEETS
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{(savedSheets.data ?? []).slice(0, 8).map((sheet) => (
								<Badge key={sheet.id} variant="outline">
									{sheet.reference} · {sheet.title} ·{" "}
									{formatMoney(sheet.finalTotalCents, sheet.currency)}
								</Badge>
							))}
						</div>
					</div>
				) : null}
			</Panel>
			<Panel
				title="AI opportunity review"
				description="Upload a proposal or discovery document. The assistant maps requirements to the live catalog and saves the review as a CRM note."
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
		</div>
	);
}

function ForecastCalculator() {
	const trpc = useTRPC();
	const [values, setValues] = useState({
		months: "12",
		monthlyLeads: "20",
		conversionPct: "15",
		averageDeal: "250000",
		grossMarginPct: "45",
		monthlyGrowthPct: "5",
		monthlyChurnPct: "2",
		acquisitionCost: "25000",
		fixedOperatingCost: "500000",
		payrollCost: "1000000",
		cashOnHand: "0",
	});
	const [result, setResult] = useState<Awaited<
		ReturnType<typeof forecastPlaceholder>
	> | null>(null);
	const forecast = useMutation(
		trpc.operations.forecast.mutationOptions({
			onSuccess: (data) => setResult(data as never),
			onError: (error) => toast.error(error.message),
		}),
	);
	const set =
		(key: keyof typeof values) =>
		(event: React.ChangeEvent<HTMLInputElement>) =>
			setValues((current) => ({ ...current, [key]: event.target.value }));
	const money = (value: string) => Math.round((Number(value) || 0) * 100);
	return (
		<Panel
			title="Financial forecasting & business optimization"
			description="Admin-only deterministic projections. Calculations run in code rather than consuming AI tokens."
		>
			<div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
				<div className="grid grid-cols-2 gap-3">
					{(
						[
							["months", "Forecast months"],
							["monthlyLeads", "Monthly leads"],
							["conversionPct", "Conversion %"],
							["averageDeal", "Average deal (JMD)"],
							["grossMarginPct", "Gross margin %"],
							["monthlyGrowthPct", "Monthly growth %"],
							["monthlyChurnPct", "Monthly churn %"],
							["acquisitionCost", "CAC per client (JMD)"],
							["fixedOperatingCost", "Fixed monthly cost (JMD)"],
							["payrollCost", "Monthly payroll (JMD)"],
							["cashOnHand", "Cash on hand (JMD)"],
						] as Array<[keyof typeof values, string]>
					).map(([key, title]) => (
						<Field key={key} label={title}>
							<Input
								inputMode="decimal"
								value={values[key]}
								onChange={set(key)}
							/>
						</Field>
					))}
					<Button
						className="col-span-2"
						disabled={forecast.isPending}
						onClick={() =>
							forecast.mutate({
								months: Math.max(1, Math.round(Number(values.months) || 12)),
								monthlyLeads: Number(values.monthlyLeads) || 0,
								conversionPct: Number(values.conversionPct) || 0,
								averageDealCents: money(values.averageDeal),
								grossMarginPct: Number(values.grossMarginPct) || 0,
								monthlyGrowthPct: Number(values.monthlyGrowthPct) || 0,
								monthlyChurnPct: Number(values.monthlyChurnPct) || 0,
								acquisitionCostCents: money(values.acquisitionCost),
								fixedOperatingCostCents: money(values.fixedOperatingCost),
								payrollCostCents: money(values.payrollCost),
								cashOnHandCents: money(values.cashOnHand),
							})
						}
					>
						{forecast.isPending ? "Calculating…" : "Run forecast"}
					</Button>
				</div>
				<div className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<Metric
							label="Projected revenue"
							value={formatMoney(
								result?.summary.projectedRevenueCents ?? 0,
								"JMD",
							)}
							detail="Across the selected forecast horizon"
						/>
						<Metric
							label="Projected profit"
							value={formatMoney(
								result?.summary.projectedProfitCents ?? 0,
								"JMD",
							)}
							detail="After delivery, acquisition and operating costs"
							good={(result?.summary.projectedProfitCents ?? 0) >= 0}
						/>
						<Metric
							label="Ending cash"
							value={formatMoney(result?.summary.endingCashCents ?? 0, "JMD")}
							detail="Projected closing cash position"
							good={(result?.summary.endingCashCents ?? 0) >= 0}
						/>
						<Metric
							label="Break-even"
							value={
								result?.summary.breakEvenMonth
									? `Month ${result.summary.breakEvenMonth}`
									: "Not reached"
							}
							detail={
								result?.summary.cacPaybackMonths == null
									? "CAC payback unavailable"
									: `${result.summary.cacPaybackMonths} month CAC payback`
							}
						/>
					</div>
					<div className="max-h-96 overflow-auto rounded-xl border">
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b">
									<th className="p-2 text-left">Month</th>
									<th>Revenue</th>
									<th>Profit</th>
									<th>Cash</th>
								</tr>
							</thead>
							<tbody>
								{(result?.monthly ?? []).map((row) => (
									<tr key={row.month} className="border-b">
										<td className="p-2">{row.month}</td>
										<td className="text-right">
											{formatMoney(row.revenueCents, "JMD")}
										</td>
										<td className="text-right">
											{formatMoney(row.profitCents, "JMD")}
										</td>
										<td className="pr-2 text-right">
											{formatMoney(row.cashCents, "JMD")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</Panel>
	);
}

async function forecastPlaceholder() {
	return {
		summary: {
			projectedRevenueCents: 0,
			projectedProfitCents: 0,
			endingCashCents: 0,
			breakEvenMonth: null as number | null,
			cacPaybackMonths: null as number | null,
		},
		monthly: [] as Array<{
			month: number;
			revenueCents: number;
			profitCents: number;
			cashCents: number;
		}>,
	};
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
	const [criteria, setCriteria] = useState<
		Array<{
			key: string;
			name: string;
			kind: "FIXED" | "PER_UNIT" | "PERCENTAGE";
			unitLabel: string;
			defaultQuantity: string;
			unitCost: string;
			percentage: string;
			required: boolean;
			active: boolean;
		}>
	>([]);
	useEffect(() => {
		if (!item) return;
		const cost = item.costProfile;
		setValues({
			currency: cost?.currency ?? "JMD",
			base: String((cost?.baseCostCents ?? 0) / 100),
			pricingUnit: cost?.pricingUnit ?? "engagement",
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
		setCriteria(
			(cost?.criteria ?? []).map((criterion) => ({
				key: criterion.id,
				name: criterion.name,
				kind: criterion.kind as "FIXED" | "PER_UNIT" | "PERCENTAGE",
				unitLabel: criterion.unitLabel,
				defaultQuantity: String(criterion.defaultQuantity),
				unitCost: String(criterion.unitCostCents / 100),
				percentage: String(criterion.percentage),
				required: criterion.required,
				active: criterion.active,
			})),
		);
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
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Costing · {item.name}</DialogTitle>
					<DialogDescription>
						These values drive service economics and deal analysis. They are
						administrative planning figures, not ledger entries.
					</DialogDescription>
				</DialogHeader>
				<div className="grid max-h-[60vh] gap-3 overflow-y-auto">
					<div className="grid grid-cols-3 gap-3">
						<Field label="Currency">
							<Input
								value={values.currency ?? "JMD"}
								onChange={set("currency")}
							/>
						</Field>
						<Field label="Base cost">
							<Input
								inputMode="decimal"
								value={values.base ?? ""}
								onChange={set("base")}
							/>
						</Field>
						<Field label="Pricing unit">
							<Input
								value={values.pricingUnit ?? ""}
								onChange={set("pricingUnit")}
							/>
						</Field>
					</div>
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
					<div className="rounded-xl border p-3">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-medium">Costing criteria</p>
								<p className="text-xs text-muted-foreground">
									Reusable fixed, per-unit or percentage cost drivers.
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									setCriteria((current) => [
										...current,
										{
											key: crypto.randomUUID(),
											name: "",
											kind: "PER_UNIT",
											unitLabel: "unit",
											defaultQuantity: "1",
											unitCost: "0",
											percentage: "0",
											required: false,
											active: true,
										},
									])
								}
							>
								<Add /> Add criterion
							</Button>
						</div>
						<div className="mt-3 space-y-2">
							{criteria.map((criterion, index) => (
								<div
									key={criterion.key}
									className="grid gap-2 rounded-lg bg-muted/30 p-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
								>
									<Input
										aria-label="Criterion name"
										placeholder="Users, locations, data migration…"
										value={criterion.name}
										onChange={(event) =>
											setCriteria((current) =>
												current.map((entry, entryIndex) =>
													entryIndex === index
														? { ...entry, name: event.target.value }
														: entry,
												),
											)
										}
									/>
									<SelectInput
										value={criterion.kind}
										onChange={(event) =>
											setCriteria((current) =>
												current.map((entry, entryIndex) =>
													entryIndex === index
														? {
																...entry,
																kind: event.target
																	.value as typeof criterion.kind,
															}
														: entry,
												),
											)
										}
										options={["FIXED", "PER_UNIT", "PERCENTAGE"]}
									/>
									<Input
										aria-label="Unit label"
										placeholder="unit"
										value={criterion.unitLabel}
										onChange={(event) =>
											setCriteria((current) =>
												current.map((entry, entryIndex) =>
													entryIndex === index
														? { ...entry, unitLabel: event.target.value }
														: entry,
												),
											)
										}
									/>
									<Input
										aria-label={
											criterion.kind === "PERCENTAGE"
												? "Percentage"
												: "Unit cost"
										}
										inputMode="decimal"
										value={
											criterion.kind === "PERCENTAGE"
												? criterion.percentage
												: criterion.unitCost
										}
										onChange={(event) =>
											setCriteria((current) =>
												current.map((entry, entryIndex) =>
													entryIndex === index
														? {
																...entry,
																[criterion.kind === "PERCENTAGE"
																	? "percentage"
																	: "unitCost"]: event.target.value,
															}
														: entry,
												),
											)
										}
									/>
									<IconDelete
										label={`Delete ${criterion.name || "criterion"}`}
										onClick={() =>
											setCriteria((current) =>
												current.filter((_, entryIndex) => entryIndex !== index),
											)
										}
									/>
									<div className="flex items-center gap-4 text-xs text-muted-foreground md:col-span-5">
										<label
											className="flex items-center gap-2"
											htmlFor={`criterion-quantity-${criterion.key}`}
										>
											Default quantity{" "}
											<Input
												id={`criterion-quantity-${criterion.key}`}
												className="h-7 w-24"
												inputMode="decimal"
												value={criterion.defaultQuantity}
												onChange={(event) =>
													setCriteria((current) =>
														current.map((entry, entryIndex) =>
															entryIndex === index
																? {
																		...entry,
																		defaultQuantity: event.target.value,
																	}
																: entry,
														),
													)
												}
											/>
										</label>
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={criterion.required}
												onChange={(event) =>
													setCriteria((current) =>
														current.map((entry, entryIndex) =>
															entryIndex === index
																? { ...entry, required: event.target.checked }
																: entry,
														),
													)
												}
											/>{" "}
											Required
										</label>
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={criterion.active}
												onChange={(event) =>
													setCriteria((current) =>
														current.map((entry, entryIndex) =>
															entryIndex === index
																? { ...entry, active: event.target.checked }
																: entry,
														),
													)
												}
											/>{" "}
											Active
										</label>
									</div>
								</div>
							))}
						</div>
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
								baseCostCents: cents(values.base),
								pricingUnit: values.pricingUnit || "engagement",
								implementationCostCents: cents(values.implementation),
								deliveryCostCents: cents(values.delivery),
								monthlyRunCostCents: cents(values.run),
								monthlyHostingCostCents: cents(values.hosting),
								contractorCostCents: cents(values.contractor),
								internalHours: Number(values.hours || 0),
								targetMarginPct: Number(values.margin || 0),
								listPriceCents: cents(values.price),
								notes: values.notes || null,
								criteria: criteria
									.filter((criterion) => criterion.name.trim())
									.map((criterion) => ({
										name: criterion.name.trim(),
										kind: criterion.kind,
										unitLabel: criterion.unitLabel || "unit",
										defaultQuantity: Number(criterion.defaultQuantity || 0),
										unitCostCents: cents(criterion.unitCost),
										percentage: Number(criterion.percentage || 0),
										required: criterion.required,
										active: criterion.active,
									})),
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
