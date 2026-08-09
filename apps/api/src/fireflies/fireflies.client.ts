import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const ENDPOINT = "https://api.fireflies.ai/graphql";

export type FirefliesTranscript = {
	id: string;
	title?: string;
	organizer_email?: string;
	participants?: string[];
	date?: number;
	duration?: number;
	transcript_url?: string;
	cal_id?: string;
	calendar_id?: string;
	summary?: {
		keywords?: string[];
		action_items?: unknown;
		overview?: string;
		short_summary?: string;
		gist?: string;
	};
};

@Injectable()
export class FirefliesClient {
	constructor(private readonly config: ConfigService) {}

	async transcript(id: string): Promise<FirefliesTranscript> {
		const apiKey = this.config.get<string>("FIREFLIES_API_KEY");
		if (!apiKey) {
			throw new ServiceUnavailableException("Fireflies is not configured.");
		}

		const response = await fetch(ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query:
					"query Transcript($transcriptId: String!) { transcript(id: $transcriptId) { id title organizer_email participants date duration transcript_url cal_id calendar_id summary { keywords action_items overview short_summary gist } } }",
				variables: { transcriptId: id },
			}),
			signal: AbortSignal.timeout(7000),
		});

		if (!response.ok) {
			throw new ServiceUnavailableException(
				`Fireflies returned HTTP ${response.status}.`,
			);
		}

		const payload = (await response.json()) as {
			data?: { transcript?: FirefliesTranscript | null };
			errors?: Array<{ message?: string }>;
		};
		const transcript = payload.data?.transcript;
		if (!transcript) {
			throw new ServiceUnavailableException(
				payload.errors?.[0]?.message ?? "Fireflies returned no transcript.",
			);
		}

		return transcript;
	}
}
