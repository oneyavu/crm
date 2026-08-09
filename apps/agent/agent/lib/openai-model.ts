import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export const OPENAI_MODEL_ID = "openai/gpt-5-nano";
export const OPENAI_CONTEXT_WINDOW_TOKENS = 400_000;

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function openAIModel(modelId = OPENAI_MODEL_ID): LanguageModel {
	const selected = modelId.startsWith("openai/") ? modelId : OPENAI_MODEL_ID;
	const slug = selected.slice("openai/".length);
	return openai(slug);
}
