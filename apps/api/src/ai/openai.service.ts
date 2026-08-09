import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type ChatMessage = { role: "user" | "assistant"; content: string };

@Injectable()
export class OpenAiService {
	configured() {
		return Boolean(process.env.OPENAI_API_KEY?.trim());
	}

	async reply(system: string, history: ChatMessage[]): Promise<string> {
		const key = process.env.OPENAI_API_KEY?.trim();
		if (!key) {
			throw new ServiceUnavailableException(
				"GPT-5.5 is ready but the OpenAI API connection has not been authorized yet.",
			);
		}

		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-5.5",
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
				"GPT-5.5 returned an empty response.",
			);
		}
		return content.trim();
	}
}
