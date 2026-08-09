import { isWorkspaceAdmin } from "@crm/auth";
import { BusinessRecordType, type Db, type Prisma } from "@crm/db";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { OpenAiService } from "../ai/openai.service";
import { decimalFromCents, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type {
	compensationInput,
	dealAnalysisInput,
	documentInput,
	expenseCategoryInput,
	financialAccountInput,
	forecastInput,
	messageTemplateInput,
	metricInput,
	pricingInput,
	staffProfileInput,
} from "./operations.contracts";

@Injectable()
export class OperationsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly ai: OpenAiService,
	) {}

	async overview(actorId: string) {
		await this.assertAdmin(actorId);
		const [
			expense,
			revenue,
			openProjects,
			overdueTasks,
			accounts,
			staff,
			documents,
		] = await Promise.all([
			this.db.businessRecord.aggregate({
				where: { type: BusinessRecordType.EXPENSE, includedInFinancials: true },
				_sum: { amount: true },
				_count: true,
			}),
			this.db.invoice.aggregate({
				where: { status: { not: "VOID" } },
				_sum: { total: true, amountPaid: true },
				_count: true,
			}),
			this.db.project.count({
				where: { status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } },
			}),
			this.db.projectTask.count({
				where: { status: { not: "DONE" }, dueDate: { lt: new Date() } },
			}),
			this.db.financialAccount.aggregate({
				where: { active: true },
				_sum: { currentBalance: true },
				_count: true,
			}),
			this.db.staffProfile.count({ where: { active: true } }),
			this.db.businessDocument.count(),
		]);
		const invoicedCents = toCents(revenue._sum.total) ?? 0;
		const expenseCents = toCents(expense._sum.amount) ?? 0;
		return {
			expenseCents,
			invoicedCents,
			collectedCents: toCents(revenue._sum.amountPaid) ?? 0,
			grossMarginCents: invoicedCents - expenseCents,
			openProjects,
			overdueTasks,
			accountBalanceCents: toCents(accounts._sum.currentBalance) ?? 0,
			accountCount: accounts._count,
			activeStaff: staff,
			documentCount: documents,
		};
	}

	async expenseCategories(actorId: string): Promise<
		Array<{
			id: string;
			name: string;
			description: string | null;
			active: boolean;
			source: string;
			sourceId: string | null;
			createdAt: Date;
			updatedAt: Date;
		}>
	> {
		await this.assertAdmin(actorId);
		return this.db.expenseCategory.findMany({
			orderBy: [{ active: "desc" }, { name: "asc" }],
		});
	}
	async templates(actorId: string): Promise<
		Array<{
			id: string;
			kind: "EMAIL" | "SUGGESTED_REPLY";
			name: string;
			subject: string | null;
			body: string;
			category: string | null;
			active: boolean;
			source: string;
			sourceId: string | null;
			createdAt: Date;
			updatedAt: Date;
		}>
	> {
		await this.assertAdmin(actorId);
		return this.db.messageTemplate.findMany({
			orderBy: [{ kind: "asc" }, { name: "asc" }],
		});
	}
	async financialAccounts(actorId: string) {
		await this.assertAdmin(actorId);
		const rows = await this.db.financialAccount.findMany({
			orderBy: [{ active: "desc" }, { name: "asc" }],
		});
		return rows.map(({ openingBalance, currentBalance, ...row }) => ({
			...row,
			openingBalanceCents: toCents(openingBalance) ?? 0,
			currentBalanceCents: toCents(currentBalance) ?? 0,
		}));
	}
	async staff(actorId: string) {
		await this.assertAdmin(actorId);
		const rows = await this.db.staffProfile.findMany({
			orderBy: [{ active: "desc" }, { name: "asc" }],
			include: {
				compensationPlans: { orderBy: { effectiveFrom: "desc" } },
				metrics: { orderBy: { periodStart: "desc" }, take: 50 },
			},
		});
		return rows.map((row) => ({
			...row,
			compensationPlans: row.compensationPlans.map((plan) => ({
				...plan,
				baseAmountCents: toCents(plan.baseAmount) ?? 0,
				hourlyRateCents: toCents(plan.hourlyRate) ?? 0,
				commissionPct: Number(plan.commissionPct),
			})),
			metrics: row.metrics.map((metric) => ({
				...metric,
				target: metric.target === null ? null : Number(metric.target),
				actual: metric.actual === null ? null : Number(metric.actual),
			})),
		}));
	}
	async pricing(actorId: string) {
		await this.assertAdmin(actorId);
		const rows = await this.db.catalogItem.findMany({
			where: { active: true },
			orderBy: [{ category: "asc" }, { name: "asc" }],
			include: { costProfile: true },
		});
		return rows.map(({ costProfile, ...item }) => ({
			...item,
			costProfile: costProfile
				? {
						...costProfile,
						implementationCostCents:
							toCents(costProfile.implementationCost) ?? 0,
						deliveryCostCents: toCents(costProfile.deliveryCost) ?? 0,
						monthlyRunCostCents: toCents(costProfile.monthlyRunCost) ?? 0,
						monthlyHostingCostCents:
							toCents(costProfile.monthlyHostingCost) ?? 0,
						contractorCostCents: toCents(costProfile.contractorCost) ?? 0,
						internalHours: Number(costProfile.internalHours),
						targetMarginPct: Number(costProfile.targetMarginPct),
						listPriceCents: toCents(costProfile.listPrice) ?? 0,
					}
				: null,
		}));
	}
	async documents(actorId: string): Promise<
		Array<{
			id: string;
			kind:
				| "ANNUAL_FILING"
				| "TAX"
				| "ORC"
				| "TCC"
				| "CERTIFICATE"
				| "LICENSE"
				| "CONTRACT"
				| "MSA"
				| "COMPANY_STAMP"
				| "AUTHORIZED_SIGNATURE"
				| "DIRECTOR_RECORD"
				| "INVESTOR_AGREEMENT"
				| "POLICY"
				| "OTHER";
			title: string;
			label: string | null;
			description: string | null;
			projectId: string | null;
			fileName: string;
			mediaType: string;
			size: number;
			expiresAt: Date | null;
			createdAt: Date;
			updatedAt: Date;
			project: { id: string; name: string } | null;
		}>
	> {
		await this.assertAdmin(actorId);
		return this.db.businessDocument.findMany({
			orderBy: { updatedAt: "desc" },
			select: {
				id: true,
				kind: true,
				title: true,
				label: true,
				description: true,
				projectId: true,
				fileName: true,
				mediaType: true,
				size: true,
				expiresAt: true,
				createdAt: true,
				updatedAt: true,
				project: { select: { id: true, name: true } },
			},
		});
	}
	async document(id: string, actorId: string) {
		await this.assertAdmin(actorId);
		const row = await this.db.businessDocument.findUnique({ where: { id } });
		if (!row) throw new NotFoundException("Document not found.");
		return {
			...row,
			contentBase64: Buffer.from(row.content).toString("base64"),
			content: undefined,
		};
	}
	async documentContent(id: string, actorId: string) {
		await this.assertAdmin(actorId);
		const row = await this.db.businessDocument.findUnique({
			where: { id },
			select: { fileName: true, mediaType: true, content: true },
		});
		if (!row) throw new NotFoundException("Document not found.");
		return row;
	}

	async saveExpenseCategory(
		input: z.infer<typeof expenseCategoryInput>,
		actorId: string,
	) {
		await this.assertAdmin(actorId);
		const row = input.id
			? await this.db.expenseCategory.update({
					where: { id: input.id },
					data: clean(input),
				})
			: await this.db.expenseCategory.create({ data: clean(input) });
		await this.audit(
			"ExpenseCategory",
			row.id,
			input.id ? "UPDATE" : "CREATE",
			actorId,
			`${input.id ? "Updated" : "Created"} expense category ${row.name}`,
			row,
		);
		return row;
	}
	async saveTemplate(
		input: z.infer<typeof messageTemplateInput>,
		actorId: string,
	) {
		await this.assertAdmin(actorId);
		const row = input.id
			? await this.db.messageTemplate.update({
					where: { id: input.id },
					data: clean(input),
				})
			: await this.db.messageTemplate.create({ data: clean(input) });
		await this.audit(
			"MessageTemplate",
			row.id,
			input.id ? "UPDATE" : "CREATE",
			actorId,
			`${input.id ? "Updated" : "Created"} ${row.kind.toLowerCase()} ${row.name}`,
			row,
		);
		return row;
	}
	async saveFinancialAccount(
		input: z.infer<typeof financialAccountInput>,
		actorId: string,
	) {
		await this.assertAdmin(actorId);
		const values = {
			...clean(input),
			openingBalance: moneyValue(input.openingBalanceCents),
			currentBalance: moneyValue(input.currentBalanceCents),
			openingBalanceCents: undefined,
			currentBalanceCents: undefined,
		};
		const row = input.id
			? await this.db.financialAccount.update({
					where: { id: input.id },
					data: values,
				})
			: await this.db.financialAccount.create({ data: values });
		await this.audit(
			"FinancialAccount",
			row.id,
			input.id ? "UPDATE" : "CREATE",
			actorId,
			`${input.id ? "Updated" : "Created"} account ${row.name}`,
			{ id: row.id, name: row.name },
		);
		return { id: row.id, name: row.name };
	}
	async saveStaff(input: z.infer<typeof staffProfileInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const values = {
			...clean(input),
			email: input.email.toLowerCase(),
			startDate: date(input.startDate),
			endDate: date(input.endDate),
		};
		const row = input.id
			? await this.db.staffProfile.update({
					where: { id: input.id },
					data: values,
				})
			: await this.db.staffProfile.create({ data: values });
		await this.audit(
			"StaffProfile",
			row.id,
			input.id ? "UPDATE" : "CREATE",
			actorId,
			`${input.id ? "Updated" : "Created"} staff profile ${row.name}`,
			{ id: row.id, name: row.name },
		);
		return row;
	}
	async saveCompensation(
		input: z.infer<typeof compensationInput>,
		actorId: string,
	) {
		await this.assertAdmin(actorId);
		const values = {
			...clean(input),
			currency: input.currency.toUpperCase(),
			baseAmount: moneyValue(input.baseAmountCents),
			hourlyRate: moneyValue(input.hourlyRateCents),
			effectiveFrom: requiredDate(input.effectiveFrom),
			effectiveTo: date(input.effectiveTo),
			baseAmountCents: undefined,
			hourlyRateCents: undefined,
		};
		const row = input.id
			? await this.db.staffCompensationPlan.update({
					where: { id: input.id },
					data: values,
				})
			: await this.db.staffCompensationPlan.create({ data: values });
		await this.audit(
			"StaffCompensationPlan",
			row.id,
			input.id ? "UPDATE" : "CREATE",
			actorId,
			`${input.id ? "Updated" : "Created"} compensation plan ${row.name}`,
			{ id: row.id, name: row.name },
		);
		return { id: row.id, name: row.name };
	}
	async saveMetric(input: z.infer<typeof metricInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const values = {
			...clean(input),
			periodStart: requiredDate(input.periodStart),
			periodEnd: requiredDate(input.periodEnd),
		};
		const row = input.id
			? await this.db.staffMetric.update({
					where: { id: input.id },
					data: values,
				})
			: await this.db.staffMetric.create({ data: values });
		await this.audit(
			"StaffMetric",
			row.id,
			input.id ? "UPDATE" : "CREATE",
			actorId,
			`${input.id ? "Updated" : "Created"} ${row.kind.toLowerCase()} ${row.title}`,
			{ id: row.id, title: row.title },
		);
		return row;
	}
	async savePricing(input: z.infer<typeof pricingInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const values = {
			currency: input.currency.toUpperCase(),
			implementationCost: moneyValue(input.implementationCostCents),
			deliveryCost: moneyValue(input.deliveryCostCents),
			monthlyRunCost: moneyValue(input.monthlyRunCostCents),
			monthlyHostingCost: moneyValue(input.monthlyHostingCostCents),
			contractorCost: moneyValue(input.contractorCostCents),
			internalHours: input.internalHours,
			targetMarginPct: input.targetMarginPct,
			listPrice: moneyValue(input.listPriceCents),
			notes: input.notes || null,
		};
		const row = await this.db.catalogCostProfile.upsert({
			where: { catalogItemId: input.catalogItemId },
			create: { catalogItemId: input.catalogItemId, ...values },
			update: values,
		});
		await this.audit(
			"CatalogCostProfile",
			row.id,
			"UPSERT",
			actorId,
			"Updated product/service costing",
			{ id: row.id, catalogItemId: row.catalogItemId },
		);
		return { id: row.id, catalogItemId: row.catalogItemId };
	}
	async saveDocument(input: z.infer<typeof documentInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const content = Buffer.from(input.contentBase64, "base64");
		if (content.byteLength > 10_000_000)
			throw new ForbiddenException("Documents are limited to 10 MB.");
		const row = await this.db.businessDocument.create({
			data: {
				kind: input.kind,
				title: input.title,
				label: input.label || null,
				description: input.description || null,
				projectId: input.projectId || null,
				fileName: input.fileName,
				mediaType: input.mediaType,
				size: content.byteLength,
				content,
				expiresAt: date(input.expiresAt),
			},
		});
		await this.audit(
			"BusinessDocument",
			row.id,
			"CREATE",
			actorId,
			`Uploaded ${row.title}`,
			{ id: row.id, fileName: row.fileName },
		);
		return { id: row.id, title: row.title, fileName: row.fileName };
	}
	async analyzeDeal(input: z.infer<typeof dealAnalysisInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const catalog = await this.pricing(actorId);
		const catalogContext = catalog
			.map((item) => ({
				code: item.code,
				name: item.name,
				kind: item.kind,
				category: item.category,
				summary: item.summary,
				capabilities: item.capabilities,
				costProfile: item.costProfile,
			}))
			.slice(0, 200);
		const analysis = await this.ai.analyzeFiles(
			"You are VAYU's deal architect and commercial reviewer. Analyze only the supplied opportunity and VAYU catalog. Produce concise Markdown with: executive fit score (0-100), requirements mapped to exact catalog items, uncovered requirements, strengths, weaknesses/risks, in-house vs contractor/outsourcing comparison with separate scores and reasoning, delivery assumptions, cost/margin flags, questions, and a clear recommendation. Never invent pricing or capability. Flag missing facts explicitly.",
			`${input.prompt}\n\nCURRENT VAYU CATALOG AND COST PROFILES:\n${JSON.stringify(catalogContext)}`,
			input.files,
		);
		const record = await this.db.businessRecord.create({
			data: {
				type: BusinessRecordType.NOTE,
				title: `Deal analysis · ${new Date().toLocaleDateString("en-CA")}`,
				status: "AI REVIEW",
				description: analysis,
				companyId: input.companyId || null,
				projectId: input.projectId || null,
				source: "OPENAI",
				metadata: {
					fileNames: input.files.map((file) => file.name),
					requestedBy: actorId,
				},
			},
		});
		await this.audit(
			"BusinessRecord",
			record.id,
			"AI_ANALYSIS",
			actorId,
			"Created deal analysis",
			{ id: record.id, fileNames: input.files.map((file) => file.name) },
		);
		return { id: record.id, analysis };
	}

	async forecast(input: z.infer<typeof forecastInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const current = await this.overview(actorId);
		const monthly: Array<{
			month: number; leads: number; customers: number; revenueCents: number;
			deliveryCostCents: number; acquisitionCostCents: number;
			operatingCostCents: number; profitCents: number; cashCents: number;
		}> = [];
		let cash = input.cashOnHandCents;
		let recurringRevenue = Math.max(0, Math.round(current.collectedCents / 12));
		let cumulativeProfit = 0;
		for (let month = 1; month <= input.months; month += 1) {
			const leads = input.monthlyLeads * (1 + input.monthlyGrowthPct / 100) ** (month - 1);
			const customers = leads * (input.conversionPct / 100);
			const newRevenue = Math.round(customers * input.averageDealCents);
			recurringRevenue = Math.max(0, Math.round(recurringRevenue * (1 - input.monthlyChurnPct / 100)));
			const revenue = newRevenue + recurringRevenue;
			const deliveryCost = Math.round(revenue * (1 - input.grossMarginPct / 100));
			const acquisitionCost = Math.round(customers * input.acquisitionCostCents);
			const operatingCost = input.fixedOperatingCostCents + input.payrollCostCents;
			const profit = revenue - deliveryCost - acquisitionCost - operatingCost;
			cash += profit;
			cumulativeProfit += profit;
			monthly.push({ month, leads: Math.round(leads), customers: Number(customers.toFixed(2)), revenueCents: revenue, deliveryCostCents: deliveryCost, acquisitionCostCents: acquisitionCost, operatingCostCents: operatingCost, profitCents: profit, cashCents: cash });
			recurringRevenue += Math.round(newRevenue * 0.15);
		}
		const breakEven = monthly.find((row) => row.profitCents >= 0)?.month ?? null;
		const cacPaybackMonths = input.averageDealCents > 0 && input.grossMarginPct > 0
			? input.acquisitionCostCents / (input.averageDealCents * (input.grossMarginPct / 100))
			: null;
		return {
			current,
			monthly,
			summary: {
				projectedRevenueCents: monthly.reduce((sum, row) => sum + row.revenueCents, 0),
				projectedProfitCents: cumulativeProfit,
				endingCashCents: cash,
				breakEvenMonth: breakEven,
				cacPaybackMonths: cacPaybackMonths == null ? null : Number(cacPaybackMonths.toFixed(2)),
				minimumCashCents: Math.min(input.cashOnHandCents, ...monthly.map((row) => row.cashCents)),
			},
		};
	}

	async remove(
		kind:
			| "expenseCategory"
			| "messageTemplate"
			| "financialAccount"
			| "staffProfile"
			| "staffCompensationPlan"
			| "staffMetric"
			| "businessDocument",
		id: string,
		actorId: string,
	) {
		await this.assertAdmin(actorId);
		const deleted = await (async () => {
			switch (kind) {
				case "expenseCategory":
					return (await this.db.expenseCategory.deleteMany({ where: { id } }))
						.count;
				case "messageTemplate":
					return (await this.db.messageTemplate.deleteMany({ where: { id } }))
						.count;
				case "financialAccount":
					return (await this.db.financialAccount.deleteMany({ where: { id } }))
						.count;
				case "staffProfile":
					return (await this.db.staffProfile.deleteMany({ where: { id } }))
						.count;
				case "staffCompensationPlan":
					return (
						await this.db.staffCompensationPlan.deleteMany({ where: { id } })
					).count;
				case "staffMetric":
					return (await this.db.staffMetric.deleteMany({ where: { id } }))
						.count;
				case "businessDocument":
					return (await this.db.businessDocument.deleteMany({ where: { id } }))
						.count;
			}
		})();
		if (!deleted) throw new NotFoundException(`${kind} not found.`);
		await this.audit(kind, id, "DELETE", actorId, `Deleted ${kind}`, { id });
		return { id };
	}

	private async assertAdmin(userId: string) {
		const member = await this.db.member.findFirst({
			where: { userId },
			select: { role: true },
		});
		if (!isWorkspaceAdmin(member?.role as never))
			throw new ForbiddenException(
				"Workspace administrator access is required.",
			);
	}
	private audit(
		entityType: string,
		entityId: string,
		action: string,
		actorId: string,
		summary: string,
		after: unknown,
	) {
		return this.db.auditEntry.create({
			data: {
				entityType,
				entityId,
				action,
				actorId,
				summary,
				after: json(after),
			},
		});
	}
}

function clean<T extends { id?: string }>(input: T): Omit<T, "id"> {
	const { id: _id, ...rest } = input;
	return rest;
}
function date(value: string | null | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function requiredDate(value: string): Date {
	const parsed = date(value);
	if (!parsed) throw new ForbiddenException("Enter a valid date.");
	return parsed;
}
function moneyValue(cents: number) {
	return decimalFromCents(cents) ?? 0;
}
function json(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
