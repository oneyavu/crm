import { describe, expect, it } from "bun:test";
import {
	stableJson,
	validWebhookSignature,
	webhookSignature,
} from "../src/platform-operations/webhook-signature";

describe("VAYU platform webhook signatures", () => {
	it("canonicalizes object keys while preserving array order", () => {
		expect(stableJson({ z: 1, a: { y: 2, b: [3, 1] } })).toBe(
			'{"a":{"b":[3,1],"y":2},"z":1}',
		);
	});

	it("accepts an authentic fresh payload", () => {
		const now = Date.UTC(2026, 7, 12, 15, 0, 0);
		const timestamp = String(now / 1000);
		const body = { email: "client@example.com", consent: true };
		const secret = "a".repeat(32);
		expect(
			validWebhookSignature({
				body,
				timestamp,
				signature: webhookSignature(body, timestamp, secret),
				secret,
				now,
			}),
		).toBe(true);
	});

	it("rejects tampering and replayed requests", () => {
		const now = Date.UTC(2026, 7, 12, 15, 0, 0);
		const timestamp = String(now / 1000);
		const secret = "b".repeat(32);
		const signature = webhookSignature({ value: 1 }, timestamp, secret);
		expect(
			validWebhookSignature({
				body: { value: 2 },
				timestamp,
				signature,
				secret,
				now,
			}),
		).toBe(false);
		expect(
			validWebhookSignature({
				body: { value: 1 },
				timestamp,
				signature,
				secret,
				now: now + 300_001,
			}),
		).toBe(false);
	});
});
