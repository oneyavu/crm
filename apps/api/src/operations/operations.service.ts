import { isWorkspaceAdmin } from "@crm/auth";
import { BusinessRecordType, type Db, type Prisma } from "@crm/db";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { z } from "zod";
import { OpenAiService } from "../ai/openai.service";
import { decimalFromCents, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type {
	compensationInput,
	dealAnalysisInput,
	dealSheetInput,
	documentInput,
	expenseCategoryInput,
	financialAccountInput,
	forecastInput,
	marketResearchInput,
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
			include: {
				costProfile: {
					include: { criteria: { orderBy: { position: "asc" } } },
				},
			},
		});
		return rows.map(({ costProfile, ...item }) => ({
			...item,
			costProfile: costProfile
				? {
						...costProfile,
						baseCostCents: toCents(costProfile.baseCost) ?? 0,
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
						criteria: costProfile.criteria.map((criterion) => ({
							...criterion,
							defaultQuantity: Number(criterion.defaultQuantity),
							unitCostCents: toCents(criterion.unitCost) ?? 0,
							percentage: Number(criterion.percentage),
						})),
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
			baseCost: moneyValue(input.baseCostCents),
			pricingUnit: input.pricingUnit,
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
		const row = await this.db.$transaction(async (tx) => {
			const profile = await tx.catalogCostProfile.upsert({
				where: { catalogItemId: input.catalogItemId },
				create: { catalogItemId: input.catalogItemId, ...values },
				update: values,
			});
			await tx.costingCriterion.deleteMany({
				where: { catalogCostProfileId: profile.id },
			});
			if (input.criteria.length) {
				await tx.costingCriterion.createMany({
					data: input.criteria.map((criterion, position) => ({
						catalogCostProfileId: profile.id,
						name: criterion.name,
						kind: criterion.kind,
						unitLabel: criterion.unitLabel,
						defaultQuantity: criterion.defaultQuantity,
						unitCost: moneyValue(criterion.unitCostCents),
						percentage: criterion.percentage,
						required: criterion.required,
						active: criterion.active,
						position,
					})),
				});
			}
			return profile;
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

	async dealSheets(actorId: string) {
		await this.assertAdmin(actorId);
		const rows = await this.db.dealSheet.findMany({
			orderBy: { updatedAt: "desc" },
			take: 100,
			include: {
				company: { select: { id: true, name: true } },
				project: { select: { id: true, name: true } },
				lines: { orderBy: { position: "asc" } },
			},
		});
		return rows.map(serializeDealSheet);
	}

	async saveDealSheet(input: z.infer<typeof dealSheetInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const totals = calculateDealSheet(input);
		const row = await this.db.$transaction(async (tx) => {
			const data = {
				title: input.title,
				status: input.status,
				currency: input.currency.toUpperCase(),
				marketRegion: input.marketRegion,
				companyId: input.companyId || null,
				projectId: input.projectId || null,
				contingencyPct: input.contingencyPct,
				discountPct: input.discountPct,
				taxPct: input.taxPct,
				targetMarginPct: input.targetMarginPct,
				directCost: moneyValue(totals.directCostCents),
				contingencyAmount: moneyValue(totals.contingencyAmountCents),
				targetPrice: moneyValue(totals.targetPriceCents),
				discountAmount: moneyValue(totals.discountAmountCents),
				subtotal: moneyValue(totals.subtotalCents),
				taxAmount: moneyValue(totals.taxAmountCents),
				finalTotal: moneyValue(totals.finalTotalCents),
				notes: input.notes || null,
			};
			const sheet = input.id
				? await tx.dealSheet.update({ where: { id: input.id }, data })
				: await tx.dealSheet.create({
						data: {
							...data,
							reference: `DS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
							createdById: actorId,
						},
					});
			await tx.dealSheetLine.deleteMany({ where: { dealSheetId: sheet.id } });
			await tx.dealSheetLine.createMany({
				data: input.lines.map((line, position) => {
					const directCostCents = Math.round(
						(line.baseCostCents + line.criteriaCostCents) * line.quantity,
					);
					return {
						dealSheetId: sheet.id,
						catalogItemId: line.catalogItemId || null,
						description: line.description,
						quantity: line.quantity,
						unit: line.unit,
						baseCost: moneyValue(line.baseCostCents),
						criteriaCost: moneyValue(line.criteriaCostCents),
						directCost: moneyValue(directCostCents),
						suggestedPrice: moneyValue(line.suggestedPriceCents),
						marketLow: nullableMoney(line.marketLowCents),
						marketMedian: nullableMoney(line.marketMedianCents),
						marketHigh: nullableMoney(line.marketHighCents),
						criteriaSnapshot: json(line.criteriaSnapshot),
						researchRationale: line.researchRationale || null,
						position,
					};
				}),
			});
			return sheet;
		});
		await this.audit(
			"DealSheet",
			row.id,
			input.id ? "UPDATE" : "CREATE",
			actorId,
			`${input.id ? "Updated" : "Created"} deal sheet ${row.reference}`,
			{ id: row.id, reference: row.reference, ...totals },
		);
		return { id: row.id, reference: row.reference, totals };
	}

	async researchMarket(
		input: z.infer<typeof marketResearchInput>,
		actorId: string,
	) {
		await this.assertAdmin(actorId);
		const result = await this.ai.researchWithWeb(
			"You are a commercial market researcher. Search current public sources for comparable software and professional-service prices. Return ONLY valid JSON with keys summary and lines. lines must contain index, low, median, high, rationale. Monetary values must be plain numbers in the requested currency. Prefer vendor pricing pages and credible current benchmarks. If evidence is weak, say so and use null prices. Never change or calculate the user's final deal price.",
			`Market: ${input.marketRegion}\nCurrency: ${input.currency.toUpperCase()}\nOfferings: ${JSON.stringify(input.lines)}`,
		);
		const parsed = parseResearchJson(result.text);
		return {
			summary: parsed.summary,
			lines: parsed.lines,
			sources: result.sources,
			researchedAt: new Date().toISOString(),
		};
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
			month: number;
			leads: number;
			customers: number;
			revenueCents: number;
			deliveryCostCents: number;
			acquisitionCostCents: number;
			operatingCostCents: number;
			profitCents: number;
			cashCents: number;
		}> = [];
		let cash = input.cashOnHandCents;
		let recurringRevenue = Math.max(0, Math.round(current.collectedCents / 12));
		let cumulativeProfit = 0;
		for (let month = 1; month <= input.months; month += 1) {
			const leads =
				input.monthlyLeads * (1 + input.monthlyGrowthPct / 100) ** (month - 1);
			const customers = leads * (input.conversionPct / 100);
			const newRevenue = Math.round(customers * input.averageDealCents);
			recurringRevenue = Math.max(
				0,
				Math.round(recurringRevenue * (1 - input.monthlyChurnPct / 100)),
			);
			const revenue = newRevenue + recurringRevenue;
			const deliveryCost = Math.round(
				revenue * (1 - input.grossMarginPct / 100),
			);
			const acquisitionCost = Math.round(
				customers * input.acquisitionCostCents,
			);
			const operatingCost =
				input.fixedOperatingCostCents + input.payrollCostCents;
			const profit = revenue - deliveryCost - acquisitionCost - operatingCost;
			cash += profit;
			cumulativeProfit += profit;
			monthly.push({
				month,
				leads: Math.round(leads),
				customers: Number(customers.toFixed(2)),
				revenueCents: revenue,
				deliveryCostCents: deliveryCost,
				acquisitionCostCents: acquisitionCost,
				operatingCostCents: operatingCost,
				profitCents: profit,
				cashCents: cash,
			});
			recurringRevenue += Math.round(newRevenue * 0.15);
		}
		const breakEven =
			monthly.find((row) => row.profitCents >= 0)?.month ?? null;
		const cacPaybackMonths =
			input.averageDealCents > 0 && input.grossMarginPct > 0
				? input.acquisitionCostCents /
					(input.averageDealCents * (input.grossMarginPct / 100))
				: null;
		return {
			current,
			monthly,
			summary: {
				projectedRevenueCents: monthly.reduce(
					(sum, row) => sum + row.revenueCents,
					0,
				),
				projectedProfitCents: cumulativeProfit,
				endingCashCents: cash,
				breakEvenMonth: breakEven,
				cacPaybackMonths:
					cacPaybackMonths == null ? null : Number(cacPaybackMonths.toFixed(2)),
				minimumCashCents: Math.min(
					input.cashOnHandCents,
					...monthly.map((row) => row.cashCents),
				),
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
function nullableMoney(cents: number | null | undefined) {
	return cents == null ? null : moneyValue(cents);
}
function json(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function calculateDealSheet(input: z.infer<typeof dealSheetInput>) {
	const directCostCents = input.lines.reduce(
		(sum, line) =>
			sum +
			Math.round((line.baseCostCents + line.criteriaCostCents) * line.quantity),
		0,
	);
	const contingencyAmountCents = Math.round(
		directCostCents * (input.contingencyPct / 100),
	);
	const costWithContingency = directCostCents + contingencyAmountCents;
	const marginRate = input.targetMarginPct / 100;
	const calculatedTarget = Math.round(costWithContingency / (1 - marginRate));
	const lineSuggestedTotal = input.lines.reduce(
		(sum, line) => sum + Math.round(line.suggestedPriceCents * line.quantity),
		0,
	);
	const targetPriceCents = Math.max(calculatedTarget, lineSuggestedTotal);
	const discountAmountCents = Math.round(
		targetPriceCents * (input.discountPct / 100),
	);
	const subtotalCents = targetPriceCents - discountAmountCents;
	const taxAmountCents = Math.round(subtotalCents * (input.taxPct / 100));
	return {
		directCostCents,
		contingencyAmountCents,
		targetPriceCents,
		discountAmountCents,
		subtotalCents,
		taxAmountCents,
		finalTotalCents: subtotalCents + taxAmountCents,
	};
}

function serializeDealSheet(row: {
	id: string;
	reference: string;
	title: string;
	currency: string;
	directCost: Prisma.Decimal;
	contingencyAmount: Prisma.Decimal;
	targetPrice: Prisma.Decimal;
	discountAmount: Prisma.Decimal;
	subtotal: Prisma.Decimal;
	taxAmount: Prisma.Decimal;
	finalTotal: Prisma.Decimal;
	contingencyPct: Prisma.Decimal;
	discountPct: Prisma.Decimal;
	taxPct: Prisma.Decimal;
	targetMarginPct: Prisma.Decimal;
	lines: Array<{
		quantity: Prisma.Decimal;
		baseCost: Prisma.Decimal;
		criteriaCost: Prisma.Decimal;
		directCost: Prisma.Decimal;
		suggestedPrice: Prisma.Decimal;
		marketLow: Prisma.Decimal | null;
		marketMedian: Prisma.Decimal | null;
		marketHigh: Prisma.Decimal | null;
		[key: string]: unknown;
	}>;
	[key: string]: unknown;
}) {
	return {
		...row,
		contingencyPct: Number(row.contingencyPct),
		discountPct: Number(row.discountPct),
		taxPct: Number(row.taxPct),
		targetMarginPct: Number(row.targetMarginPct),
		directCostCents: toCents(row.directCost) ?? 0,
		contingencyAmountCents: toCents(row.contingencyAmount) ?? 0,
		targetPriceCents: toCents(row.targetPrice) ?? 0,
		discountAmountCents: toCents(row.discountAmount) ?? 0,
		subtotalCents: toCents(row.subtotal) ?? 0,
		taxAmountCents: toCents(row.taxAmount) ?? 0,
		finalTotalCents: toCents(row.finalTotal) ?? 0,
		lines: row.lines.map((line) => ({
			...line,
			quantity: Number(line.quantity),
			baseCostCents: toCents(line.baseCost) ?? 0,
			criteriaCostCents: toCents(line.criteriaCost) ?? 0,
			directCostCents: toCents(line.directCost) ?? 0,
			suggestedPriceCents: toCents(line.suggestedPrice) ?? 0,
			marketLowCents: toCents(line.marketLow),
			marketMedianCents: toCents(line.marketMedian),
			marketHighCents: toCents(line.marketHigh),
		})),
	};
}

function parseResearchJson(text: string): {
	summary: string;
	lines: Array<{
		index: number;
		low: number | null;
		median: number | null;
		high: number | null;
		rationale: string;
	}>;
} {
	try {
		const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
		const value = JSON.parse(raw) as { summary?: unknown; lines?: unknown };
		const lines = Array.isArray(value.lines) ? value.lines : [];
		return {
			summary:
				typeof value.summary === "string"
					? value.summary
					: "Market research completed.",
			lines: lines.map((entry, index) => {
				const item = entry as Record<string, unknown>;
				const amount = (key: string) =>
					typeof item[key] === "number" && Number.isFinite(item[key])
						? Math.max(0, Math.round(item[key] as number))
						: null;
				return {
					index:
						typeof item.index === "number" ? Math.round(item.index) : index,
					low: amount("low"),
					median: amount("median"),
					high: amount("high"),
					rationale: typeof item.rationale === "string" ? item.rationale : "",
				};
			}),
		};
	} catch {
		throw new ServiceUnavailableException(
			"Market research returned an invalid format. Please try again.",
		);
	}
}
