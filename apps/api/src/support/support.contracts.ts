import { z } from "zod";

export const saveWidgetInput = z.object({
	name: z.string().trim().min(2).max(80),
	welcomeMessage: z.string().trim().min(2).max(500),
	accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
	position: z.enum(["BOTTOM_LEFT", "BOTTOM_RIGHT"]),
	aiEnabled: z.boolean(),
	liveSupportEnabled: z.boolean(),
	requireEmail: z.boolean(),
	allowedDomains: z.array(z.string().trim().min(1).max(255)).max(20),
	quickActions: z.array(z.string().trim().min(1).max(80)).max(6),
	knowledgeText: z.string().trim().max(20_000),
	active: z.boolean(),
});

export const supportConversationInput = z.object({ id: z.string().min(1) });
export const supportFormalizeInput = z.object({ id: z.string().min(1) });

export const supportReplyInput = z.object({
	id: z.string().min(1),
	message: z.string().trim().min(1).max(4_000),
});

export const updateSupportConversationInput = z.object({
	id: z.string().min(1),
	status: z.enum(["AI_ACTIVE", "WAITING_FOR_AGENT", "LIVE_AGENT", "CLOSED"]),
});

export const publicWidgetChatInput = z.object({
	sessionToken: z.string().min(1).optional(),
	message: z.string().trim().min(1).max(4_000),
	name: z.string().trim().max(120).optional(),
	email: z.string().email().optional(),
	host: z.string().trim().max(255).optional(),
});
