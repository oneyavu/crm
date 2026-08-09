import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type ChatMessage = { role: "user" | "assistant"; content: string };
type InputFile = { name: string; mediaType: string; contentBase64: string };
type WebSource = { title: string; url: string };
type AssistantFile = { name: string; mediaType: string; contentBase64: string };

const COST_FIRST_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5-nano";

@Injectable()
export class OpenAiService {
	configured() {
		return Boolean(process.env.OPENAI_API_KEY?.trim());
	}

	async reply(system: string, history: ChatMessage[]): Promise<string> {
		const key = process.env.OPENAI_API_KEY?.trim();
		if (!key) {
			throw new ServiceUnavailableException(
				"AI assistance is temporarily unavailable.",
			);
		}

		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: COST_FIRST_MODEL,
				reasoning_effort: "low",
				max_completion_tokens: 1200,
				messages: [{ role: "system", content: system }, ...history],
			}),
			signal: AbortSignal.timeout(60_000),
		});

		if (!response.ok) {
			const requestId = response.headers.get("x-request-id");
			throw new ServiceUnavailableException(
				`OpenAI could not complete that request${requestId ? ` (${requestId})` : ""}.`,
			);
		}

		const body = (await response.json()) as {
			choices?: Array<{ message?: { content?: unknown } }>;
		};
		const content = body.choices?.[0]?.message?.content;
		if (typeof content !== "string" || !content.trim()) {
			throw new ServiceUnavailableException(
				"The AI service returned an empty response.",
			);
		}
		return content.trim();
	}

	async analyzeFiles(
		system: string,
		prompt: string,
		files: InputFile[],
	): Promise<string> {
		const key = process.env.OPENAI_API_KEY?.trim();
		if (!key)
			throw new ServiceUnavailableException(
				"AI assistance is temporarily unavailable.",
			);
		const content: Array<Record<string, string>> = [
			{ type: "input_text", text: prompt },
			...files.map((file) => ({
				type: "input_file",
				filename: file.name,
				file_data: `data:${file.mediaType};base64,${file.contentBase64}`,
			})),
		];
		const response = await fetch("https://api.openai.com/v1/responses", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: COST_FIRST_MODEL,
				reasoning: { effort: "low" },
				max_output_tokens: 2400,
				instructions: system,
				input: [{ role: "user", content }],
				store: false,
			}),
			signal: AbortSignal.timeout(120_000),
		});
		if (!response.ok) {
			const requestId = response.headers.get("x-request-id");
			throw new ServiceUnavailableException(
				`OpenAI could not analyze those files${requestId ? ` (${requestId})` : ""}.`,
			);
		}
		const body = (await response.json()) as {
			output_text?: unknown;
			output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
		};
		const output =
			typeof body.output_text === "string"
				? body.output_text
				: body.output
						?.flatMap((item) => item.content ?? [])
						.find((item) => item.type === "output_text")?.text;
		if (!output?.trim())
			throw new ServiceUnavailableException(
				"The AI service returned an empty analysis.",
			);
		return output.trim();
	}

	async researchWithWeb(
		instructions: string,
		prompt: string,
	): Promise<{ text: string; sources: WebSource[] }> {
		const key = process.env.OPENAI_API_KEY?.trim();
		if (!key)
			throw new ServiceUnavailableException(
				"AI market research is temporarily unavailable.",
			);
		const response = await fetch("https://api.openai.com/v1/responses", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: COST_FIRST_MODEL,
				reasoning: { effort: "low" },
				max_output_tokens: 3000,
				instructions,
				input: prompt,
				tools: [{ type: "web_search", search_context_size: "medium" }],
				include: ["web_search_call.action.sources"],
				store: false,
			}),
			signal: AbortSignal.timeout(120_000),
		});
		if (!response.ok) {
			const requestId = response.headers.get("x-request-id");
			throw new ServiceUnavailableException(
				`OpenAI could not research the market${requestId ? ` (${requestId})` : ""}.`,
			);
		}
		const body = (await response.json()) as {
			output_text?: unknown;
			output?: Array<{
				type?: string;
				action?: { sources?: Array<{ title?: string; url?: string }> };
				content?: Array<{
					type?: string;
					text?: string;
					annotations?: Array<{ title?: string; url?: string }>;
				}>;
			}>;
		};
		const text =
			typeof body.output_text === "string"
				? body.output_text
				: body.output
						?.flatMap((item) => item.content ?? [])
						.find((item) => item.type === "output_text")?.text;
		if (!text?.trim())
			throw new ServiceUnavailableException(
				"The AI service returned empty market research.",
			);
		const sourceMap = new Map<string, WebSource>();
		for (const item of body.output ?? []) {
			for (const source of item.action?.sources ?? []) {
				if (source.url)
					sourceMap.set(source.url, {
						title: source.title || new URL(source.url).hostname,
						url: source.url,
					});
			}
			for (const content of item.content ?? []) {
				for (const annotation of content.annotations ?? []) {
					if (annotation.url)
						sourceMap.set(annotation.url, {
							title: annotation.title || new URL(annotation.url).hostname,
							url: annotation.url,
						});
				}
			}
		}
		return { text: text.trim(), sources: [...sourceMap.values()].slice(0, 20) };
	}

	async buildInvoiceAction(
		instructions: string,
		prompt: string,
		files: AssistantFile[],
	): Promise<Record<string, unknown>> {
		const key = process.env.OPENAI_API_KEY?.trim();
		if (!key)
			throw new ServiceUnavailableException(
				"AI invoice assistance is temporarily unavailable.",
			);
		const content: Array<Record<string, unknown>> = [
			{ type: "input_text", text: prompt },
		];
		for (const file of files) {
			if (file.mediaType.startsWith("image/")) {
				content.push({
					type: "input_image",
					image_url: `data:${file.mediaType};base64,${file.contentBase64}`,
					detail: "high",
				});
			} else if (file.mediaType.startsWith("video/")) {
				content.push({
					type: "input_text",
					text: `A source video named ${file.name} was attached. Use the accompanying extracted frame images and the staff description; do not claim to have heard audio that was not transcribed.`,
				});
			} else {
				content.push({
					type: "input_file",
					filename: file.name,
					file_data: `data:${file.mediaType};base64,${file.contentBase64}`,
				});
			}
		}
		const response = await fetch("https://api.openai.com/v1/responses", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: COST_FIRST_MODEL,
				reasoning: { effort: "low" },
				max_output_tokens: 3500,
				instructions,
				input: [{ role: "user", content }],
				store: false,
			}),
			signal: AbortSignal.timeout(120_000),
		});
		if (!response.ok) {
			const requestId = response.headers.get("x-request-id");
			throw new ServiceUnavailableException(
				`OpenAI could not prepare the draft${requestId ? ` (${requestId})` : ""}.`,
			);
		}
		const body = (await response.json()) as {
			output_text?: unknown;
			output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
		};
		const output =
			typeof body.output_text === "string"
				? body.output_text
				: body.output
						?.flatMap((item) => item.content ?? [])
						.find((item) => item.type === "output_text")?.text;
		if (!output?.trim())
			throw new ServiceUnavailableException(
				"The AI service returned an empty draft.",
			);
		try {
			return JSON.parse(
				output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
			) as Record<string, unknown>;
		} catch {
			throw new ServiceUnavailableException(
				"The AI draft could not be validated. Please try again.",
			);
		}
	}
}
