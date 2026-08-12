import { createHash, randomBytes } from "node:crypto";
import { isWorkspaceAdmin, WORKSPACE_ID } from "@crm/auth";
import {
	type Db,
	InquirySource,
	InquiryStatus,
	NotificationType,
	PlatformActionStatus,
	PlatformHealthStatus,
	PlatformKind,
	type Prisma,
	RecordSource,
} from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { domainFromEmail, normalizeDomain } from "../companies/domain";
import { InjectDatabase } from "../database/database.constants";
import { NotificationsService } from "../notifications/notifications.service";
import { PaperclipService } from "../paperclip/paperclip.service";
import type {
	actionRequestInput,
	connectionUpdateInput,
	inquiryListInput,
	inquiryUpdateInput,
	platformEventInput,
	websiteInquiryInput,
} from "./platform-operations.contracts";

const DEFAULT_CONNECTIONS = [
	{
		kind: PlatformKind.WEBSITE,
		name: "VAYU Website",
		baseUrl: "https://onevayu.com",
		adminUrl: "https://onevayu.com/wp-admin/",
		embedUrl: null,
		embedAllowed: false,
	},
	{
		kind: PlatformKind.SUPRCREATE,
		name: "SuprCreate",
		baseUrl: "https://suprcreate.onevayu.com",
		adminUrl: "https://suprcreate.onevayu.com/login",
		embedUrl: "https://suprcreate.onevayu.com/login",
		embedAllowed: true,
	},
	{
		kind: PlatformKind.ONECARD,
		name: "OneDigital Card",
		baseUrl: "https://card.onevayu.com",
		adminUrl: "https://card.onevayu.com/login",
		embedUrl: "https://card.onevayu.com/login",
		embedAllowed: true,
	},
	{
		kind: PlatformKind.ONEDIGITAL,
		name: "One Digital",
		baseUrl: "https://digital.onevayu.com",
		adminUrl: "https://digital.onevayu.com/login?redirect=dashboard",
		embedUrl: "https://digital.onevayu.com/login?redirect=dashboard",
		embedAllowed: true,
	},
] as const;

@Injectable()
export class PlatformOperationsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly notifications: NotificationsService,
		private readonly paperclip: PaperclipService,
		private readonly agentTriggers: AgentTriggerService,
	) {}

	async dashboard(actorId: string): Promise<{
		connections: Array<{
			id: string;
			kind: PlatformKind;
			name: string;
			adminUrl: string;
			embedUrl: string | null;
			embedAllowed: boolean;
			writeEnabled: boolean;
			readOnlyVerifiedAt: Date | null;
			healthStatus: PlatformHealthStatus;
			lastCheckedAt: Date | null;
			lastError: string | null;
		}>;
		inquiryCounts: Record<string, number>;
		pendingApprovals: number;
		alertsLast24Hours: number;
	}> {
		await this.assertAdmin(actorId);
		await this.ensureConnections();
		const [connections, inquiries, actions, events] = await Promise.all([
			this.db.platformConnection.findMany({
				orderBy: { name: "asc" },
				include: {
					events: { orderBy: { occurredAt: "desc" }, take: 10 },
					_count: { select: { events: true, actions: true } },
				},
			}),
			this.db.inquiry.groupBy({ by: ["status"], _count: { _all: true } }),
			this.db.platformAction.count({
				where: { status: PlatformActionStatus.PENDING_APPROVAL },
			}),
			this.db.platformEvent.count({
				where: {
					severity: { in: ["WARNING", "ERROR"] },
					occurredAt: { gte: new Date(Date.now() - 86_400_000) },
				},
			}),
		]);
		return {
			connections: connections.map((connection) => ({
				id: connection.id,
				kind: connection.kind,
				name: connection.name,
				adminUrl: connection.adminUrl,
				embedUrl: connection.embedUrl,
				embedAllowed: connection.embedAllowed,
				writeEnabled: connection.writeEnabled,
				readOnlyVerifiedAt: connection.readOnlyVerifiedAt,
				healthStatus: connection.healthStatus,
				lastCheckedAt: connection.lastCheckedAt,
				lastError: connection.lastError,
			})),
			inquiryCounts: Object.fromEntries(
				inquiries.map((row) => [row.status, row._count._all]),
			),
			pendingApprovals: actions,
			alertsLast24Hours: events,
		};
	}

	async inquiries(
		input: z.infer<typeof inquiryListInput>,
		actorId: string,
	): Promise<
		Array<{
			id: string;
			reference: string;
			source: InquirySource;
			status: InquiryStatus;
			organizationName: string | null;
			email: string | null;
			challenge: string | null;
			desiredOutcome: string | null;
			notes: string | null;
			createdAt: Date;
			company: { id: string; name: string } | null;
		}>
	> {
		await this.assertAdmin(actorId);
		const q = input.q.trim();
		const rows = await this.db.inquiry.findMany({
			where: {
				...(input.status ? { status: input.status } : {}),
				...(input.source ? { source: input.source } : {}),
				...(q
					? {
							OR: [
								{ reference: { contains: q, mode: "insensitive" } },
								{ organizationName: { contains: q, mode: "insensitive" } },
								{ contactName: { contains: q, mode: "insensitive" } },
								{ email: { contains: q, mode: "insensitive" } },
							],
						}
					: {}),
			},
			orderBy: { createdAt: "desc" },
			take: input.limit,
			include: {
				company: { select: { id: true, name: true } },
				contact: {
					select: { id: true, firstName: true, lastName: true, email: true },
				},
				assignedTo: { select: { id: true, name: true, email: true } },
			},
		});
		return rows.map((row) => ({
			id: row.id,
			reference: row.reference,
			source: row.source,
			status: row.status,
			organizationName: row.organizationName,
			email: row.email,
			challenge: row.challenge,
			desiredOutcome: row.desiredOutcome,
			notes: row.notes,
			createdAt: row.createdAt,
			company: row.company,
		}));
	}

	async updateInquiry(
		input: z.infer<typeof inquiryUpdateInput>,
		actorId: string,
	): Promise<{
		id: string;
		status: InquiryStatus;
		assignedToId: string | null;
		priority: string | null;
		score: number | null;
		triageSummary: string | null;
		triagedAt: Date | null;
	}> {
		await this.assertAdmin(actorId);
		const existing = await this.db.inquiry.findUnique({
			where: { id: input.id },
		});
		if (!existing) throw new NotFoundException("Inquiry not found.");
		const updated = await this.db.inquiry.update({
			where: { id: input.id },
			data: {
				status: input.status,
				assignedToId: input.assignedToId,
				priority: input.priority,
				score: input.score,
				triageSummary: input.triageSummary,
				triagedAt:
					input.status === "TRIAGED" || input.triageSummary
						? new Date()
						: undefined,
			},
		});
		await this.audit(
			"Inquiry",
			input.id,
			"UPDATE",
			actorId,
			"Updated inquiry",
			{
				status: updated.status,
				assignedToId: updated.assignedToId,
				priority: updated.priority,
				score: updated.score,
			},
		);
		return {
			id: updated.id,
			status: updated.status,
			assignedToId: updated.assignedToId,
			priority: updated.priority,
			score: updated.score,
			triageSummary: updated.triageSummary,
			triagedAt: updated.triagedAt,
		};
	}

	async receiveWebsiteInquiry(input: z.infer<typeof websiteInquiryInput>) {
		if (!input.consent)
			throw new BadRequestException("Consent is required before submission.");
		const email = input.email.trim().toLowerCase();
		const externalId =
			input.externalId ??
			`web-${createHash("sha256").update(stableJson(input)).digest("hex").slice(0, 24)}`;
		const duplicate = await this.db.inquiry.findUnique({
			where: {
				source_externalId: { source: InquirySource.WEBSITE, externalId },
			},
			select: { id: true, reference: true },
		});
		if (duplicate) return { ...duplicate, duplicate: true };

		const organizationName = clean(
			input.organizationName ?? input.organization,
		);
		const domain = normalizeDomain(input.website) ?? domainFromEmail(email);
		const contactName = clean(
			input.contactName ??
				[input.firstName, input.lastName].filter(Boolean).join(" "),
		);
		const names = splitName(
			contactName ?? email.split("@")[0] ?? "Website inquiry",
		);
		let createdCompanyId: string | null = null;
		let createdContactId: string | null = null;

		const inquiry = await this.db.$transaction(async (tx) => {
			let company = domain
				? await tx.company.findUnique({ where: { domain } })
				: organizationName
					? await tx.company.findFirst({
							where: {
								name: { equals: organizationName, mode: "insensitive" },
							},
						})
					: null;
			if (!company && (organizationName || domain)) {
				company = await tx.company.create({
					data: {
						name: organizationName ?? domain ?? "Website inquiry",
						domain,
						website: input.website ?? (domain ? `https://${domain}` : null),
						industry: input.industry,
						country: input.country,
						email,
						phone: input.phone,
						source: RecordSource.IMPORT,
					},
				});
				createdCompanyId = company.id;
			}

			let contact = await tx.contact.findUnique({ where: { email } });
			if (!contact) {
				contact = await tx.contact.create({
					data: {
						firstName: names.firstName,
						lastName: names.lastName,
						email,
						phone: input.phone,
						companyId: company?.id,
						source: RecordSource.IMPORT,
					},
				});
				createdContactId = contact.id;
			} else if (!contact.companyId && company) {
				contact = await tx.contact.update({
					where: { id: contact.id },
					data: { companyId: company.id },
				});
			}

			if (company && !company.primaryContactId) {
				await tx.company.update({
					where: { id: company.id },
					data: { primaryContactId: contact.id },
				});
			}

			return tx.inquiry.create({
				data: {
					reference: inquiryReference(),
					source: InquirySource.WEBSITE,
					externalId,
					organizationName,
					contactName,
					email,
					phone: input.phone,
					website: input.website,
					country: input.country,
					industry: input.industry,
					organizationSize: input.organizationSize,
					challenge: input.challenge,
					desiredOutcome: input.desiredOutcome,
					currentSystems: input.currentSystems,
					monthlyVolume: input.monthlyVolume,
					timeline: input.timeline,
					investment: input.investment,
					deliveryModel: input.deliveryModel,
					sensitivity: input.sensitivity,
					hosting: input.hosting,
					followUp: input.followUp,
					security: input.security,
					notes: input.notes,
					consent: input.consent,
					campaign: input.campaign as Prisma.InputJsonValue | undefined,
					rawPayload: json(input),
					companyId: company?.id,
					contactId: contact.id,
				},
			});
		});

		if (createdCompanyId)
			await this.agentTriggers.companyCreated(
				createdCompanyId,
				"Website inquiry created a client account",
			);
		if (createdContactId)
			await this.agentTriggers.contactCreated(
				createdContactId,
				"Website inquiry created a contact",
			);

		await Promise.all([
			this.notifyAdmins(
				NotificationType.INQUIRY_RECEIVED,
				`New inquiry: ${organizationName ?? contactName ?? email}`,
				input.challenge ?? "A new website inquiry is ready for review.",
				"/platform-operations?view=inquiries",
			),
			this.paperclip.automation("inquiry-triage", {
				inquiryId: inquiry.id,
				reference: inquiry.reference,
				companyId: inquiry.companyId,
				contactId: inquiry.contactId,
			}),
		]);

		return { id: inquiry.id, reference: inquiry.reference, duplicate: false };
	}

	async receivePlatformEvent(
		kind: PlatformKind,
		input: z.infer<typeof platformEventInput>,
	) {
		await this.ensureConnections();
		const connection = await this.db.platformConnection.findUnique({
			where: { kind },
		});
		if (!connection)
			throw new NotFoundException("Platform connection not found.");
		const occurredAt = input.occurredAt
			? new Date(input.occurredAt)
			: new Date();
		const row = input.externalId
			? await this.db.platformEvent.upsert({
					where: {
						connectionId_externalId: {
							connectionId: connection.id,
							externalId: input.externalId,
						},
					},
					create: {
						connectionId: connection.id,
						...input,
						occurredAt,
						payload: json(input.payload),
					},
					update: {
						type: input.type,
						severity: input.severity,
						title: input.title,
						summary: input.summary,
						occurredAt,
						payload: json(input.payload),
					},
				})
			: await this.db.platformEvent.create({
					data: {
						connectionId: connection.id,
						...input,
						occurredAt,
						payload: json(input.payload),
					},
				});
		await this.db.platformConnection.update({
			where: { id: connection.id },
			data: { lastSyncAt: new Date() },
		});
		if (input.externalId && input.type === "action.completed") {
			await this.db.platformAction.updateMany({
				where: { id: input.externalId, connectionId: connection.id },
				data: {
					status: PlatformActionStatus.COMPLETED,
					result: json(input.payload),
				},
			});
		}
		if (input.severity !== "INFO") {
			await this.notifyAdmins(
				NotificationType.PLATFORM_ALERT,
				`${connection.name}: ${input.title}`,
				input.summary ?? "A platform alert requires review.",
				"/platform-operations",
			);
		}
		await this.paperclip.automation("platform-update", {
			platform: kind,
			eventId: row.id,
			eventType: row.type,
			severity: row.severity,
		});
		return { accepted: true, id: row.id };
	}

	async saveConnection(
		input: z.infer<typeof connectionUpdateInput>,
		actorId: string,
	): Promise<{ id: string; kind: PlatformKind }> {
		await this.assertAdmin(actorId);
		const row = await this.db.platformConnection.upsert({
			where: { kind: input.kind },
			create: input,
			update: input,
		});
		await this.audit(
			"PlatformConnection",
			row.id,
			"UPDATE",
			actorId,
			`Updated ${row.name} connection`,
			{ kind: row.kind, enabled: row.enabled, embedAllowed: row.embedAllowed },
		);
		return { id: row.id, kind: row.kind };
	}

	async checkHealth(actorId?: string): Promise<
		Array<{
			id: string;
			kind: PlatformKind;
			healthStatus: PlatformHealthStatus;
			lastCheckedAt: Date | null;
			lastError: string | null;
		}>
	> {
		if (actorId) await this.assertAdmin(actorId);
		await this.ensureConnections();
		const connections = await this.db.platformConnection.findMany({
			where: { enabled: true },
		});
		const results = [];
		for (const connection of connections) {
			const previous = connection.healthStatus;
			const result = await probe(connection.adminUrl);
			const updated = await this.db.platformConnection.update({
				where: { id: connection.id },
				data: {
					healthStatus: result.status,
					lastCheckedAt: new Date(),
					lastHealthyAt:
						result.status === PlatformHealthStatus.HEALTHY
							? new Date()
							: undefined,
					lastError: result.error,
					metadata: json({ httpStatus: result.httpStatus }),
				},
			});
			results.push({
				id: updated.id,
				kind: updated.kind,
				healthStatus: updated.healthStatus,
				lastCheckedAt: updated.lastCheckedAt,
				lastError: updated.lastError,
			});
			if (
				previous !== updated.healthStatus &&
				updated.healthStatus !== PlatformHealthStatus.HEALTHY
			) {
				await this.notifyAdmins(
					NotificationType.PLATFORM_ALERT,
					`${updated.name} needs attention`,
					updated.lastError ??
						`Health status changed to ${updated.healthStatus}.`,
					"/platform-operations",
				);
			}
		}
		await this.paperclip.automation("platform-health", {
			results: results.map((row) => ({
				platform: row.kind,
				status: row.healthStatus,
				lastError: row.lastError,
			})),
		});
		return results;
	}

	async markReadOnlyVerified(
		kind: PlatformKind,
		actorId: string,
	): Promise<{
		id: string;
		kind: PlatformKind;
		readOnlyVerifiedAt: Date | null;
	}> {
		await this.assertAdmin(actorId);
		const row = await this.connection(kind);
		if (row.healthStatus !== PlatformHealthStatus.HEALTHY)
			throw new BadRequestException(
				"The connector must pass its health check before verification.",
			);
		const updated = await this.db.platformConnection.update({
			where: { id: row.id },
			data: { readOnlyVerifiedAt: new Date() },
		});
		return {
			id: updated.id,
			kind: updated.kind,
			readOnlyVerifiedAt: updated.readOnlyVerifiedAt,
		};
	}

	async setWriteAccess(
		kind: PlatformKind,
		enabled: boolean,
		confirmation: string | undefined,
		actorId: string,
	): Promise<{ id: string; kind: PlatformKind; writeEnabled: boolean }> {
		await this.assertAdmin(actorId);
		const row = await this.connection(kind);
		if (enabled && !row.readOnlyVerifiedAt)
			throw new BadRequestException(
				"Verify the read-only connector before enabling approved writes.",
			);
		if (enabled && confirmation !== "ENABLE APPROVED WRITES")
			throw new BadRequestException(
				"Write enablement confirmation is required.",
			);
		const updated = await this.db.platformConnection.update({
			where: { id: row.id },
			data: { writeEnabled: enabled },
		});
		await this.audit(
			"PlatformConnection",
			row.id,
			enabled ? "ENABLE_WRITES" : "DISABLE_WRITES",
			actorId,
			`${enabled ? "Enabled" : "Disabled"} approved writes for ${row.name}`,
			{ writeEnabled: enabled },
		);
		return {
			id: updated.id,
			kind: updated.kind,
			writeEnabled: updated.writeEnabled,
		};
	}

	async requestAction(
		input: z.infer<typeof actionRequestInput>,
		actorId: string,
	): Promise<{ id: string; status: PlatformActionStatus }> {
		await this.assertAdmin(actorId);
		const connection = await this.connection(input.kind);
		if (!connection.writeEnabled)
			throw new ForbiddenException(
				"Approved writes are disabled for this platform.",
			);
		const row = await this.db.platformAction.create({
			data: {
				connectionId: connection.id,
				kind: input.action,
				summary: input.summary,
				payload: json(input.payload),
				requestedById: actorId,
			},
		});
		await this.audit(
			"PlatformAction",
			row.id,
			"REQUEST",
			actorId,
			row.summary,
			{ platform: input.kind, action: input.action },
		);
		return { id: row.id, status: row.status };
	}

	async decideAction(
		id: string,
		decision: "APPROVE" | "REJECT",
		actorId: string,
	): Promise<{ id: string; status: PlatformActionStatus }> {
		await this.assertAdmin(actorId);
		const action = await this.db.platformAction.findUnique({
			where: { id },
			include: { connection: true },
		});
		if (!action) throw new NotFoundException("Platform action not found.");
		if (action.status !== PlatformActionStatus.PENDING_APPROVAL)
			throw new BadRequestException("This action has already been decided.");
		if (decision === "REJECT") {
			const rejected = await this.db.platformAction.update({
				where: { id },
				data: {
					status: PlatformActionStatus.REJECTED,
					approvedById: actorId,
					approvedAt: new Date(),
				},
			});
			return { id: rejected.id, status: rejected.status };
		}
		if (!action.connection.writeEnabled)
			throw new ForbiddenException(
				"Writes were disabled after this request was created.",
			);
		const queued = await this.paperclip.automation(
			"approved-platform-action",
			{
				actionId: action.id,
				platform: action.connection.kind,
				action: action.kind,
				summary: action.summary,
				payload: action.payload,
			},
			actorId,
		);
		const updated = await this.db.platformAction.update({
			where: { id },
			data: {
				status: queued.queued
					? PlatformActionStatus.QUEUED
					: PlatformActionStatus.APPROVED,
				approvedById: actorId,
				approvedAt: new Date(),
			},
		});
		await this.audit(
			"PlatformAction",
			id,
			"APPROVE",
			actorId,
			`Approved ${action.summary}`,
			{ queued: queued.queued },
		);
		return { id: updated.id, status: updated.status };
	}

	async actions(actorId: string): Promise<
		Array<{
			id: string;
			kind: string;
			summary: string;
			status: PlatformActionStatus;
			connection: { kind: PlatformKind; name: string };
			requestedBy: { id: string; name: string; email: string };
		}>
	> {
		await this.assertAdmin(actorId);
		const rows = await this.db.platformAction.findMany({
			orderBy: { createdAt: "desc" },
			take: 100,
			include: {
				connection: { select: { kind: true, name: true } },
				requestedBy: { select: { id: true, name: true, email: true } },
				approvedBy: { select: { id: true, name: true, email: true } },
			},
		});
		return rows.map((row) => ({
			id: row.id,
			kind: row.kind,
			summary: row.summary,
			status: row.status,
			connection: row.connection,
			requestedBy: row.requestedBy,
		}));
	}

	async dailyBrief() {
		await this.ensureConnections();
		const since = new Date(Date.now() - 86_400_000);
		const [newInquiries, alerts, pendingActions, connections] =
			await Promise.all([
				this.db.inquiry.count({ where: { createdAt: { gte: since } } }),
				this.db.platformEvent.count({
					where: {
						occurredAt: { gte: since },
						severity: { in: ["WARNING", "ERROR"] },
					},
				}),
				this.db.platformAction.count({
					where: { status: PlatformActionStatus.PENDING_APPROVAL },
				}),
				this.db.platformConnection.findMany({
					select: { kind: true, healthStatus: true },
				}),
			]);
		const summary = `${newInquiries} new inquiries, ${alerts} platform alerts and ${pendingActions} actions awaiting approval.`;
		await Promise.all([
			this.paperclip.automation("daily-operations-brief", {
				newInquiries,
				alerts,
				pendingActions,
				connections,
			}),
			this.notifyAdmins(
				NotificationType.DAILY_BRIEF,
				"Daily Platform Operations brief",
				summary,
				"/platform-operations",
			),
		]);
		return { newInquiries, alerts, pendingActions, connections };
	}

	private async ensureConnections() {
		for (const connection of DEFAULT_CONNECTIONS) {
			await this.db.platformConnection.upsert({
				where: { kind: connection.kind },
				create: connection,
				update: {},
			});
		}
	}

	private async connection(kind: PlatformKind) {
		await this.ensureConnections();
		const row = await this.db.platformConnection.findUnique({
			where: { kind },
		});
		if (!row) throw new NotFoundException("Platform connection not found.");
		return row;
	}

	private async assertAdmin(userId: string) {
		const member = await this.db.member.findUnique({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId },
			},
			select: { role: true },
		});
		if (!isWorkspaceAdmin(member?.role as never))
			throw new ForbiddenException(
				"Workspace administrator access is required.",
			);
	}

	private async notifyAdmins(
		type: NotificationType,
		title: string,
		body: string,
		href: string,
	) {
		const members = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			select: { userId: true, role: true },
		});
		await Promise.all(
			members
				.filter((member) => isWorkspaceAdmin(member.role as never))
				.map((member) =>
					this.notifications.notifyUser({
						userId: member.userId,
						type,
						title,
						body,
						href,
					}),
				),
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

async function probe(url: string) {
	try {
		const response = await fetch(url, {
			method: "GET",
			redirect: "manual",
			headers: { "User-Agent": "V-OS Platform Monitor/1.0" },
			signal: AbortSignal.timeout(8000),
		});
		if (response.status === 401 || response.status === 403) {
			return {
				status: PlatformHealthStatus.AUTH_REQUIRED,
				httpStatus: response.status,
				error: `Authentication returned ${response.status}.`,
			};
		}
		if (response.status >= 500) {
			return {
				status: PlatformHealthStatus.DOWN,
				httpStatus: response.status,
				error: `Platform returned ${response.status}.`,
			};
		}
		return {
			status: PlatformHealthStatus.HEALTHY,
			httpStatus: response.status,
			error: null,
		};
	} catch (error) {
		return {
			status: PlatformHealthStatus.DOWN,
			httpStatus: null,
			error: error instanceof Error ? error.message : "Health check failed.",
		};
	}
}

function splitName(value: string) {
	const parts = value.trim().split(/\s+/).filter(Boolean);
	return {
		firstName: parts[0] ?? "Website",
		lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
	};
}

function clean(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function inquiryReference() {
	const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
	return `INQ-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function json(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}
