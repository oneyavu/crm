import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import { selectedModel } from "../../lib/model";
import {
	OPENAI_CONTEXT_WINDOW_TOKENS,
	openAIModel,
} from "../../lib/openai-model";

export default defineAgent({
	description:
		"Turn one private CRM builder-chat request into a validated, reviewable team-agent version without deploying it.",
	model: defineDynamic({
		fallback: openAIModel(),
		events: { "session.started": () => selectedModel() },
	}),
	modelContextWindowTokens: OPENAI_CONTEXT_WINDOW_TOKENS,
	outputSchema: z.discriminatedUnion("status", [
		z.object({
			status: z.literal("needs_input"),
			question: z.string().min(1).max(500),
			options: z
				.array(
					z.object({
						id: z.string().min(1).max(80),
						label: z.string().min(1).max(120),
					}),
				)
				.max(4),
			allowFreeform: z.boolean(),
		}),
		z.object({
			status: z.literal("draft_ready"),
			summary: z.string().min(1).max(1000),
			agentId: z.string().min(1),
			versionId: z.string().min(1),
		}),
	]),
	limits: {
		maxInputTokensPerSession: 250_000,
		maxOutputTokensPerSession: 20_000,
		sessionTimeoutMs: 24 * 60 * 60 * 1000,
	},
});
