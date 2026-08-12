import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const websiteInquiryInput = z
	.object({
		externalId: optionalText(200),
		organizationName: optionalText(240),
		organization: optionalText(240),
		website: optionalText(500),
		country: optionalText(120),
		industry: optionalText(160),
		organizationSize: optionalText(120),
		branches: optionalText(120),
		contactName: optionalText(240),
		firstName: optionalText(120),
		lastName: optionalText(120),
		email: z.string().trim().email().max(320),
		phone: optionalText(80),
		challenge: optionalText(10_000),
		desiredOutcome: optionalText(10_000),
		currentSystems: optionalText(10_000),
		monthlyVolume: optionalText(240),
		timeline: optionalText(240),
		investment: optionalText(240),
		deliveryModel: optionalText(240),
		sensitivity: optionalText(240),
		hosting: optionalText(240),
		followUp: optionalText(240),
		security: optionalText(10_000),
		notes: optionalText(20_000),
		consent: z.boolean(),
		campaign: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough();

export const platformEventInput = z.object({
	externalId: optionalText(200),
	type: z.string().trim().min(1).max(120),
	severity: z.enum(["INFO", "WARNING", "ERROR"]).default("INFO"),
	title: z.string().trim().min(1).max(240),
	summary: optionalText(4000),
	occurredAt: z.iso.datetime().optional(),
	payload: z.record(z.string(), z.unknown()).default({}),
});

export const inquiryListInput = z.object({
	status: z
		.enum(["NEW", "TRIAGED", "QUALIFIED", "CONVERTED", "CLOSED", "SPAM"])
		.optional(),
	source: z
		.enum([
			"WEBSITE",
			"SUPRCREATE",
			"ONECARD",
			"ONEDIGITAL",
			"CHAT",
			"EMAIL",
			"MANUAL",
		])
		.optional(),
	q: z.string().trim().max(200).default(""),
	limit: z.number().int().min(1).max(250).default(100),
});

export const inquiryUpdateInput = z.object({
	id: z.string().min(1),
	status: z
		.enum(["NEW", "TRIAGED", "QUALIFIED", "CONVERTED", "CLOSED", "SPAM"])
		.optional(),
	assignedToId: z.string().min(1).nullable().optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullable().optional(),
	score: z.number().int().min(0).max(100).nullable().optional(),
	triageSummary: z.string().trim().max(10_000).nullable().optional(),
});

const oneVayuUrl = z
	.string()
	.url()
	.refine((value) => {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === "onevayu.com" || hostname.endsWith(".onevayu.com");
	}, "Only onevayu.com platform URLs are allowed.");

export const connectionUpdateInput = z.object({
	kind: z.enum(["WEBSITE", "SUPRCREATE", "ONECARD", "ONEDIGITAL"]),
	name: z.string().trim().min(1).max(160),
	baseUrl: oneVayuUrl,
	adminUrl: oneVayuUrl,
	embedUrl: oneVayuUrl.nullable(),
	enabled: z.boolean(),
	embedAllowed: z.boolean(),
});

export const platformKindInput = z.object({
	kind: z.enum(["WEBSITE", "SUPRCREATE", "ONECARD", "ONEDIGITAL"]),
});

export const actionRequestInput = z.object({
	kind: z.enum(["WEBSITE", "SUPRCREATE", "ONECARD", "ONEDIGITAL"]),
	action: z.string().trim().min(1).max(120),
	summary: z.string().trim().min(1).max(500),
	payload: z.record(z.string(), z.unknown()).default({}),
});

export const actionDecisionInput = z.object({
	id: z.string().min(1),
	decision: z.enum(["APPROVE", "REJECT"]),
});

export const writeAccessInput = platformKindInput.extend({
	enabled: z.boolean(),
	confirmation: z.literal("ENABLE APPROVED WRITES").optional(),
});
