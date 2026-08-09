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
		id: "openai/gpt-5.5",
		name: "GPT-5.5",
		provider: "OpenAI",
		contextWindowTokens: 1_050_000,
		pricing: { input: 5 / 1_000_000, output: 30 / 1_000_000 },
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
