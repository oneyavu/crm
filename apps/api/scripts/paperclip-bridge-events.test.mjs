import assert from "node:assert/strict";
import test from "node:test";
import {
	newRows,
	updatedRows,
	websiteInquiryEvent,
	websiteInquiryTelegramSummary,
	websiteInquiryUpdatedEvent,
	websiteInquiryUpdateTelegramSummary,
} from "./paperclip-bridge-events.mjs";

test("newRows returns only records absent from the prior snapshot", () => {
	const result = newRows(
		[{ id: "existing", updatedAt: "earlier" }],
		[
			{ id: "existing", updatedAt: "later" },
			{ id: "new-inquiry", updatedAt: "now" },
		],
	);
	assert.deepEqual(
		result.map((row) => row.id),
		["new-inquiry"],
	);
});

test("updatedRows returns only existing records with a new revision", () => {
	const result = updatedRows(
		[
			{ id: "unchanged", updatedAt: "same" },
			{ id: "changed", updatedAt: "earlier" },
		],
		[
			{ id: "unchanged", updatedAt: "same" },
			{ id: "changed", updatedAt: "later" },
			{ id: "new", updatedAt: "now" },
		],
	);
	assert.deepEqual(
		result.map((row) => row.id),
		["changed"],
	);
});

test("websiteInquiryEvent provides a stable delivery identifier", () => {
	const event = websiteInquiryEvent(
		{ id: "inq-123", reference: "INQ-123", source: "WEBSITE" },
		"2026-08-25T00:00:00.000Z",
	);
	assert.equal(event.event_type, "website.inquiry");
	assert.equal(event.idempotency_key, "website-inquiry-inq-123");
	assert.equal(event.inquiry.reference, "INQ-123");
});

test("websiteInquiryUpdatedEvent keys delivery to the inquiry revision", () => {
	const event = websiteInquiryUpdatedEvent({
		id: "inq-123",
		updatedAt: "2026-08-25T01:00:00.000Z",
	});
	assert.equal(event.event_type, "website.inquiry.updated");
	assert.match(event.idempotency_key, /inq-123/);
	assert.match(event.idempotency_key, /2026-08-25/);
});

test("websiteInquiryTelegramSummary includes the decision fields", () => {
	const summary = websiteInquiryTelegramSummary({
		reference: "INQ-123",
		organizationName: "Example Company",
		contactName: "Jane Doe",
		email: "jane@example.com",
		challenge: "Slow intake",
		desiredOutcome: "Fast routing",
		timeline: "Within 30 days",
		investment: "VAYU should recommend",
		priority: "HIGH",
	});
	assert.match(summary, /INQ-123/);
	assert.match(summary, /Slow intake/);
	assert.match(summary, /Within 30 days/);
	assert.match(summary, /without Matthew's approval/);
});

test("websiteInquiryUpdateTelegramSummary preserves the approval gate", () => {
	const summary = websiteInquiryUpdateTelegramSummary({
		reference: "INQ-123",
		organizationName: "Example Company",
		status: "QUALIFIED",
		priority: "HIGH",
		score: 91,
		triageSummary: "Discovery should be scheduled",
	});
	assert.match(summary, /QUALIFIED/);
	assert.match(summary, /pending Matthew's approval/);
});
