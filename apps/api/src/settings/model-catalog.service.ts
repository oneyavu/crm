import { Injectable } from "@nestjs/common";

export interface CatalogModel {
	id: string;
	name: string;
	provider: string;
	contextWindowTokens: number;
	pricing: { input: number; output: number } | null;
}

const OPENAI_MODELS: CatalogModel[] = [
	{
		id: "openai/gpt-5-nano",
		name: "Cost-first AI",
		provider: "OpenAI",
		contextWindowTokens: 400_000,
		pricing: { input: 0.05 / 1_000_000, output: 0.4 / 1_000_000 },
	},
];

@Injectable()
export class ModelCatalogService {
	async models(): Promise<CatalogModel[]> {
		return OPENAI_MODELS;
	}

	async find(id: string): Promise<CatalogModel | null> {
		return OPENAI_MODELS.find((model) => model.id === id) ?? null;
	}
}
