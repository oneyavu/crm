import { randomUUID } from "node:crypto";
import { isWorkspaceAdmin } from "@crm/auth";
import {
	type Db,
	SupportConversationSource,
	SupportConversationStatus,
	SupportMessageRole,
} from "@crm/db";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { OpenAiService } from "../ai/openai.service";
import { InjectDatabase } from "../database/database.constants";
import type {
	publicWidgetChatInput,
	saveWidgetInput,
} from "./support.contracts";

const DEFAULT_ACTIONS = [
	"Request a service",
	"View my invoice",
	"Talk to support",
];

@Injectable()
export class SupportService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly ai: OpenAiService,
	) {}

	async widget(actorId: string) {
		await this.assertAdmin(actorId);
		const widget = await this.db.supportWidget.findFirst({
			orderBy: { createdAt: "asc" },
		});
		return widget
			? { ...widget, quickActions: this.actions(widget.quickActions) }
			: {
					id: null,
					publicKey: null,
					name: "VAYU Concierge",
					welcomeMessage: "Hi! How can we help today?",
					accentColor: "#7bff5a",
					position: "BOTTOM_RIGHT" as const,
					aiEnabled: true,
					liveSupportEnabled: true,
					requireEmail: true,
					allowedDomains: ["onevayu.com"],
					quickActions: DEFAULT_ACTIONS,
					knowledgeText: "",
					active: false,
					createdAt: null,
					updatedAt: null,
				};
	}

	async saveWidget(input: z.infer<typeof saveWidgetInput>, actorId: string) {
		await this.assertAdmin(actorId);
		const current = await this.db.supportWidget.findFirst({
			select: { id: true },
		});
		const data = {
			...input,
			allowedDomains: input.allowedDomains.map(normalizeHost).filter(Boolean),
			quickActions: input.quickActions,
		};
		const widget = current
			? await this.db.supportWidget.update({ where: { id: current.id }, data })
			: await this.db.supportWidget.create({
					data: {
						...data,
						publicKey: `vayu_${randomUUID().replaceAll("-", "")}`,
					},
				});
		return { ...widget, quickActions: this.actions(widget.quickActions) };
	}

	async conversations(actorId: string) {
		await this.assertStaff(actorId);
		return this.db.supportConversation.findMany({
			orderBy: { lastMessageAt: "desc" },
			take: 100,
			include: {
				assignedToUser: { select: { id: true, name: true } },
				messages: { orderBy: { createdAt: "asc" }, take: 100 },
			},
		});
	}

	async updateConversation(
		id: string,
		status: SupportConversationStatus,
		actorId: string,
	) {
		await this.assertStaff(actorId);
		return this.db.supportConversation.update({
			where: { id },
			data: {
				status,
				assignedToUserId:
					status === SupportConversationStatus.LIVE_AGENT ? actorId : undefined,
				closedAt:
					status === SupportConversationStatus.CLOSED ? new Date() : null,
			},
		});
	}

	async agentReply(id: string, message: string, actorId: string) {
		await this.assertStaff(actorId);
		return this.db.$transaction(async (tx) => {
			const conversation = await tx.supportConversation.findUnique({
				where: { id },
			});
			if (!conversation) throw new NotFoundException("Conversation not found.");
			const created = await tx.supportMessage.create({
				data: {
					conversationId: id,
					role: SupportMessageRole.AGENT,
					content: message,
					authorUserId: actorId,
				},
			});
			await tx.supportConversation.update({
				where: { id },
				data: {
					status: SupportConversationStatus.LIVE_AGENT,
					assignedToUserId: actorId,
					lastMessageAt: new Date(),
				},
			});
			return created;
		});
	}

	async createServiceRequest(id: string, actorId: string) {
		await this.assertStaff(actorId);
		const conversation = await this.db.supportConversation.findFirst({
			where: { id, source: SupportConversationSource.PORTAL },
			include: {
				messages: {
					where: { role: SupportMessageRole.VISITOR },
					orderBy: { createdAt: "asc" },
				},
			},
		});
		if (!conversation?.companyId || !conversation.visitorEmail)
			throw new NotFoundException("Client portal conversation not found.");
		const companyId = conversation.companyId;
		if (conversation.subject?.startsWith("SERVICE_REQUEST:")) {
			return {
				reference: conversation.subject.slice("SERVICE_REQUEST:".length),
				created: false,
			};
		}
		const access = await this.db.clientPortalAccess.findFirst({
			where: {
				companyId: conversation.companyId,
				email: conversation.visitorEmail,
				active: true,
			},
			select: { id: true },
		});
		if (!access) throw new NotFoundException("Active client access not found.");
		const description =
			conversation.messages.at(-1)?.content ??
			"Service requested in live chat.";
		const requestedName =
			/I would like to request\s+(.+?)(?:\s+\([^)]+\))?\./i.exec(
				description,
			)?.[1] ?? "Client service request";
		const reference = `SR-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
		const created = await this.db.$transaction(async (tx) => {
			const request = await tx.serviceRequest.create({
				data: {
					reference,
					title: requestedName,
					description,
					category: "CHANGE_REQUEST",
					priority: "MEDIUM",
					companyId,
					requestedByAccessId: access.id,
					messages: {
						create: {
							source: "STAFF",
							body: `Created from live chat by the assigned agent.\n\n${description}`,
							authorUserId: actorId,
						},
					},
				},
				select: { id: true, reference: true, title: true },
			});
			await tx.supportConversation.update({
				where: { id },
				data: {
					subject: `SERVICE_REQUEST:${reference}`,
					status: "LIVE_AGENT",
					assignedToUserId: actorId,
					lastMessageAt: new Date(),
				},
			});
			await tx.supportMessage.create({
				data: {
					conversationId: id,
					role: SupportMessageRole.AGENT,
					content: `Service request ${reference} has been created and submitted to the delivery team.`,
					authorUserId: actorId,
				},
			});
			return request;
		});
		return { ...created, created: true };
	}

	async publicWidget(publicKey: string, host?: string) {
		const widget = await this.db.supportWidget.findUnique({
			where: { publicKey },
		});
		if (!widget?.active || !this.hostAllowed(widget.allowedDomains, host)) {
			throw new NotFoundException("Widget not found.");
		}
		return {
			name: widget.name,
			welcomeMessage: widget.welcomeMessage,
			accentColor: widget.accentColor,
			position: widget.position,
			requireEmail: widget.requireEmail,
			quickActions: this.actions(widget.quickActions),
			aiEnabled: widget.aiEnabled && this.ai.configured(),
			liveSupportEnabled: widget.liveSupportEnabled,
		};
	}

	async publicChat(
		publicKey: string,
		input: z.infer<typeof publicWidgetChatInput>,
	) {
		const widget = await this.db.supportWidget.findUnique({
			where: { publicKey },
		});
		if (
			!widget?.active ||
			!this.hostAllowed(widget.allowedDomains, input.host)
		) {
			throw new NotFoundException("Widget not found.");
		}

		let conversation = input.sessionToken
			? await this.db.supportConversation.findFirst({
					where: { sessionToken: input.sessionToken, widgetId: widget.id },
				})
			: null;
		if (!conversation) {
			conversation = await this.db.supportConversation.create({
				data: {
					source: SupportConversationSource.WIDGET,
					widgetId: widget.id,
					visitorName: input.name,
					visitorEmail: input.email?.toLowerCase(),
				},
			});
		}

		await this.db.supportMessage.create({
			data: {
				conversationId: conversation.id,
				role: SupportMessageRole.VISITOR,
				content: input.message,
			},
		});

		const wantsHuman =
			/(?:human|person|agent|live support|talk to support)/i.test(
				input.message,
			);
		if (wantsHuman && widget.liveSupportEnabled) {
			conversation = await this.db.supportConversation.update({
				where: { id: conversation.id },
				data: {
					status: SupportConversationStatus.WAITING_FOR_AGENT,
					lastMessageAt: new Date(),
				},
			});
			await this.db.supportMessage.create({
				data: {
					conversationId: conversation.id,
					role: SupportMessageRole.ASSISTANT,
					content:
						"I’ve routed this conversation to VAYU live support. A team member can continue here.",
				},
			});
		} else if (
			widget.aiEnabled &&
			conversation.status === SupportConversationStatus.AI_ACTIVE
		) {
			const history = await this.db.supportMessage.findMany({
				where: { conversationId: conversation.id },
				orderBy: { createdAt: "asc" },
				take: 30,
			});
			const reply = await this.ai.reply(
				`You are ${widget.name}, VAYU Limited's website concierge. Be concise, accurate, and helpful. Never invent account, project, billing, or service status. Offer live support when the visitor needs account-specific help. Knowledge supplied by VAYU:\n${widget.knowledgeText || "No additional knowledge supplied."}`,
				history.map((message) => ({
					role:
						message.role === SupportMessageRole.VISITOR ? "user" : "assistant",
					content: message.content,
				})),
			);
			await this.db.supportMessage.create({
				data: {
					conversationId: conversation.id,
					role: SupportMessageRole.ASSISTANT,
					content: reply,
				},
			});
		}

		await this.db.supportConversation.update({
			where: { id: conversation.id },
			data: { lastMessageAt: new Date() },
		});
		return {
			sessionToken: conversation.sessionToken,
			status: conversation.status,
			messages: await this.db.supportMessage.findMany({
				where: { conversationId: conversation.id },
				orderBy: { createdAt: "asc" },
				select: { id: true, role: true, content: true, createdAt: true },
			}),
		};
	}

	private actions(value: unknown): string[] {
		return Array.isArray(value)
			? value.filter((item): item is string => typeof item === "string")
			: DEFAULT_ACTIONS;
	}

	private hostAllowed(domains: string[], host?: string) {
		if (domains.length === 0) return true;
		const normalized = normalizeHost(host ?? "");
		return domains.some((domain) => {
			const allowed = normalizeHost(domain);
			return normalized === allowed || normalized.endsWith(`.${allowed}`);
		});
	}

	private async assertAdmin(userId: string) {
		const membership = await this.db.member.findFirst({
			where: { userId },
			select: { role: true },
		});
		if (!isWorkspaceAdmin(membership?.role as never)) {
			throw new ForbiddenException(
				"Workspace administrator access is required.",
			);
		}
	}

	private async assertStaff(userId: string) {
		const member = await this.db.member.findFirst({
			where: { userId },
			select: { id: true },
		});
		if (!member)
			throw new ForbiddenException("Staff workspace access is required.");
	}
}

function normalizeHost(value: string) {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/^https?:\/\//, "")
			.split("/")[0]
			?.split(":")[0] ?? ""
	);
}
