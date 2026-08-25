export function newRows(previous, current) {
	const before = new Set((previous || []).map((row) => row.id));
	return (current || []).filter((row) => !before.has(row.id));
}

export function updatedRows(previous, current) {
	const before = new Map(
		(previous || []).map((row) => [row.id, row.updatedAt]),
	);
	return (current || []).filter(
		(row) => before.has(row.id) && before.get(row.id) !== row.updatedAt,
	);
}

export function websiteInquiryEvent(
	inquiry,
	occurredAt = new Date().toISOString(),
) {
	return {
		event_type: "website.inquiry",
		source: "onevayu.com",
		idempotency_key: `website-inquiry-${inquiry.id}`,
		occurred_at: occurredAt,
		inquiry,
	};
}

export function websiteInquiryUpdatedEvent(
	inquiry,
	occurredAt = new Date().toISOString(),
) {
	return {
		event_type: "website.inquiry.updated",
		source: "onevayu.com",
		idempotency_key: `website-inquiry-updated-${inquiry.id}-${inquiry.updatedAt}`,
		occurred_at: occurredAt,
		inquiry,
	};
}

function short(value, fallback = "Not provided", limit = 500) {
	const text = String(value || "").trim();
	return text ? text.slice(0, limit) : fallback;
}

export function websiteInquiryTelegramSummary(inquiry) {
	return [
		"🔔 New V-OS website inquiry",
		`Reference: ${short(inquiry.reference)}`,
		`Organization: ${short(inquiry.organizationName)}`,
		`Contact: ${short(inquiry.contactName)} · ${short(inquiry.email)}`,
		`Challenge: ${short(inquiry.challenge)}`,
		`Desired outcome: ${short(inquiry.desiredOutcome)}`,
		`Timeline: ${short(inquiry.timeline)}`,
		`Investment signal: ${short(inquiry.investment)}`,
		`Priority: ${short(inquiry.priority, "Pending Violet triage")}`,
		"Owner: Violet — triage, nurturing and follow-up preparation.",
		"Approval: No prospect engagement, commitment or escalation will be sent without Matthew's approval.",
	].join("\n");
}

export function websiteInquiryUpdateTelegramSummary(inquiry) {
	return [
		"🟢 V-OS lead update",
		`Reference: ${short(inquiry.reference)}`,
		`Organization: ${short(inquiry.organizationName)}`,
		`Status: ${short(inquiry.status)}`,
		`Priority: ${short(inquiry.priority, "Pending Violet triage")}`,
		`Score: ${short(inquiry.score)}`,
		`Triage: ${short(inquiry.triageSummary)}`,
		"Owner: Violet — follow-up and nurturing workflow.",
		"Approval: Any external engagement remains pending Matthew's approval.",
	].join("\n");
}
