import { createHmac, timingSafeEqual } from "node:crypto";

export function webhookSignature(
	body: unknown,
	timestamp: string,
	secret: string,
): string {
	return `sha256=${createHmac("sha256", secret)
		.update(`${timestamp}.${stableJson(body)}`)
		.digest("hex")}`;
}

export function validWebhookSignature(input: {
	body: unknown;
	timestamp: string;
	signature: string;
	secret: string;
	now?: number;
}): boolean {
	const sentAt = Number(input.timestamp);
	if (
		!Number.isFinite(sentAt) ||
		Math.abs((input.now ?? Date.now()) - sentAt * 1000) > 300_000
	)
		return false;
	return constantTimeEqual(
		input.signature,
		webhookSignature(input.body, input.timestamp, input.secret),
	);
}

export function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

export function constantTimeEqual(a: string, b: string) {
	const received = Buffer.from(a);
	const expected = Buffer.from(b);
	return (
		received.length === expected.length && timingSafeEqual(received, expected)
	);
}
