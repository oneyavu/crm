import "@crm/env/load";

import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { defineAgent, defineDynamic } from "eve";
import { logCapabilities } from "./lib/capabilities";
import { selectedModel } from "./lib/model";
import { OPENAI_CONTEXT_WINDOW_TOKENS, openAIModel } from "./lib/openai-model";

void logCapabilities();

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

export default defineAgent({
	model: defineDynamic({
		fallback: openAIModel(),
		events: { "session.started": () => selectedModel() },
	}),
	modelContextWindowTokens: OPENAI_CONTEXT_WINDOW_TOKENS,
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
});
