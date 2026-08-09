import { db } from "@crm/db";
import { readAgentModel } from "@crm/db/settings";
import type { LanguageModel } from "ai";
import { openAIModel } from "./openai-model";

export interface ModelSelection {
	model: LanguageModel;
	modelContextWindowTokens: number;
}

export async function selectedModel(): Promise<ModelSelection | null> {
	try {
		const setting = await readAgentModel(db);

		if (setting.isDefault) return null;

		return {
			model: openAIModel(setting.id),
			modelContextWindowTokens: setting.contextWindowTokens,
		};
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return null;
	}
}
