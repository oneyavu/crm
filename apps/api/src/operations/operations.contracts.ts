import { z } from "zod";

export const entityIdInput = z.object({ id: z.string().min(1) });

export const expenseCategoryInput = z.object({
	id: z.string().optional(),
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(1000).nullable().optional(),
	active: z.boolean().default(true),
});

export const messageTemplateInput = z.object({
	id: z.string().optional(),
	kind: z.enum(["EMAIL", "SUGGESTED_REPLY"]),
	name: z.string().trim().min(1).max(160),
	subject: z.string().trim().max(500).nullable().optional(),
	body: z.string().trim().min(1).max(100_000),
	category: z.string().trim().max(120).nullable().optional(),
	active: z.boolean().default(true),
});

export const financialAccountInput = z.object({
	id: z.string().optional(),
	name: z.string().trim().min(1).max(160),
	kind: z.enum([
		"OPERATING",
		"SAVINGS",
		"CREDIT_CARD",
		"MERCHANT",
		"STRIPE",
		"CASH",
		"OTHER",
	]),
	institution: z.string().trim().max(160).nullable().optional(),
	currency: z
		.string()
		.trim()
		.length(3)
		.transform((value) => value.toUpperCase()),
	lastFour: z.string().trim().max(4).nullable().optional(),
	openingBalanceCents: z.number().int(),
	currentBalanceCents: z.number().int(),
	active: z.boolean().default(true),
	notes: z.string().trim().max(4000).nullable().optional(),
});

export const staffProfileInput = z.object({
	id: z.string().optional(),
	userId: z.string().nullable().optional(),
	email: z.string().email(),
	name: z.string().trim().min(1).max(160),
	jobTitle: z.string().trim().max(160).nullable().optional(),
	department: z.string().trim().max(160).nullable().optional(),
	employmentType: z.string().trim().max(80).nullable().optional(),
	active: z.boolean().default(true),
	startDate: z.string().nullable().optional(),
	endDate: z.string().nullable().optional(),
	contractSummary: z.string().trim().max(20_000).nullable().optional(),
});

export const compensationInput = z.object({
	id: z.string().optional(),
	staffProfileId: z.string().min(1),
	name: z.string().trim().min(1).max(160),
	currency: z.string().length(3),
	baseAmountCents: z.number().int().min(0),
	hourlyRateCents: z.number().int().min(0),
	commissionPct: z.number().min(0).max(100),
	bonusFormula: z.string().trim().max(4000).nullable().optional(),
	effectiveFrom: z.string(),
	effectiveTo: z.string().nullable().optional(),
	active: z.boolean().default(true),
});

export const metricInput = z.object({
	id: z.string().optional(),
	staffProfileId: z.string().min(1),
	period: z.enum([
		"DAILY",
		"WEEKLY",
		"MONTHLY",
		"QUARTERLY",
		"SEMIANNUAL",
		"ANNUAL",
	]),
	kind: z.string().trim().min(1).max(80),
	title: z.string().trim().min(1).max(240),
	target: z.number().nullable().optional(),
	actual: z.number().nullable().optional(),
	unit: z.string().trim().max(40).nullable().optional(),
	periodStart: z.string(),
	periodEnd: z.string(),
	status: z.string().trim().min(1).max(40),
	notes: z.string().trim().max(4000).nullable().optional(),
});

export const pricingInput = z.object({
	catalogItemId: z.string().min(1),
	currency: z.string().length(3),
	baseCostCents: z.number().int().min(0),
	pricingUnit: z.string().trim().min(1).max(80),
	implementationCostCents: z.number().int().min(0),
	deliveryCostCents: z.number().int().min(0),
	monthlyRunCostCents: z.number().int().min(0),
	monthlyHostingCostCents: z.number().int().min(0),
	contractorCostCents: z.number().int().min(0),
	internalHours: z.number().min(0),
	targetMarginPct: z.number().min(0).max(100),
	listPriceCents: z.number().int().min(0),
	notes: z.string().trim().max(4000).nullable().optional(),
	criteria: z
		.array(
			z.object({
				id: z.string().optional(),
				name: z.string().trim().min(1).max(160),
				kind: z.enum(["FIXED", "PER_UNIT", "PERCENTAGE"]),
				unitLabel: z.string().trim().min(1).max(80),
				defaultQuantity: z.number().min(0).max(1_000_000),
				unitCostCents: z.number().int().min(0),
				percentage: z.number().min(0).max(100),
				required: z.boolean(),
				active: z.boolean(),
			}),
		)
		.max(50),
});

const dealSheetLineInput = z.object({
	catalogItemId: z.string().nullable().optional(),
	description: z.string().trim().min(1).max(500),
	quantity: z.number().positive().max(1_000_000),
	unit: z.string().trim().min(1).max(80),
	baseCostCents: z.number().int().min(0),
	criteriaCostCents: z.number().int().min(0),
	suggestedPriceCents: z.number().int().min(0),
	marketLowCents: z.number().int().min(0).nullable().optional(),
	marketMedianCents: z.number().int().min(0).nullable().optional(),
	marketHighCents: z.number().int().min(0).nullable().optional(),
	criteriaSnapshot: z
		.array(
			z.object({
				name: z.string().max(160),
				kind: z.string().max(40),
				quantity: z.number().min(0),
				unitCostCents: z.number().int().min(0).default(0),
				percentage: z.number().min(0).max(100).default(0),
				amountCents: z.number().int().min(0),
			}),
		)
		.max(50),
	researchRationale: z.string().trim().max(4000).nullable().optional(),
});

export const dealSheetInput = z.object({
	id: z.string().optional(),
	title: z.string().trim().min(1).max(240),
	status: z.enum(["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"]),
	currency: z.string().trim().length(3),
	marketRegion: z.string().trim().min(1).max(160),
	companyId: z.string().nullable().optional(),
	projectId: z.string().nullable().optional(),
	contingencyPct: z.number().min(0).max(100),
	discountPct: z.number().min(0).max(100),
	taxPct: z.number().min(0).max(100),
	targetMarginPct: z.number().min(0).max(95),
	notes: z.string().trim().max(10_000).nullable().optional(),
	lines: z.array(dealSheetLineInput).min(1).max(100),
});

export const marketResearchInput = z.object({
	currency: z.string().trim().length(3),
	marketRegion: z.string().trim().min(1).max(160),
	lines: z
		.array(
			dealSheetLineInput.pick({
				catalogItemId: true,
				description: true,
				quantity: true,
				unit: true,
				baseCostCents: true,
				criteriaCostCents: true,
			}),
		)
		.min(1)
		.max(20),
});

export const documentInput = z.object({
	kind: z.enum([
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
	]),
	title: z.string().trim().min(1).max(240),
	label: z.string().trim().max(160).nullable().optional(),
	description: z.string().trim().max(4000).nullable().optional(),
	projectId: z.string().nullable().optional(),
	fileName: z.string().trim().min(1).max(255),
	mediaType: z.string().trim().min(1).max(160),
	contentBase64: z.string().min(1).max(20_000_000),
	expiresAt: z.string().nullable().optional(),
});

export const dealAnalysisInput = z.object({
	prompt: z.string().trim().min(1).max(20_000),
	companyId: z.string().nullable().optional(),
	projectId: z.string().nullable().optional(),
	files: z
		.array(
			z.object({
				name: z.string().trim().min(1).max(255),
				mediaType: z.string().trim().min(1).max(160),
				contentBase64: z.string().min(1).max(20_000_000),
			}),
		)
		.max(5),
});

export const forecastInput = z.object({
	months: z.number().int().min(1).max(60).default(12),
	monthlyLeads: z.number().min(0),
	conversionPct: z.number().min(0).max(100),
	averageDealCents: z.number().int().min(0),
	grossMarginPct: z.number().min(0).max(100),
	monthlyGrowthPct: z.number().min(-100).max(500),
	monthlyChurnPct: z.number().min(0).max(100),
	acquisitionCostCents: z.number().int().min(0),
	fixedOperatingCostCents: z.number().int().min(0),
	payrollCostCents: z.number().int().min(0),
	cashOnHandCents: z.number().int(),
});
