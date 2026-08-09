import { ActivityType, type Db, MeetingVisibility } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { FirefliesClient, type FirefliesTranscript } from "./fireflies.client";

@Injectable()
export class FirefliesService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly fireflies: FirefliesClient,
	) {}

	async importSummary(transcriptId: string) {
		const transcript = await this.fireflies.transcript(transcriptId);
		const meetingAt = validDate(transcript.date);
		const participants = normalizedEmails(transcript);
		const internalUsers = await this.db.user.findMany({
			where: { email: { in: participants } },
			select: { id: true, email: true },
		});
		const internal = new Set(
			internalUsers.map((user) => user.email.toLowerCase()),
		);
		const clientEmails = participants.filter((email) => !internal.has(email));
		const contact = await this.db.contact.findFirst({
			where: { email: { in: clientEmails, mode: "insensitive" } },
			select: { id: true, companyId: true },
		});

		const calendarEvent = await this.matchCalendarEvent(transcript, meetingAt);
		const companyId = calendarEvent?.companyId ?? contact?.companyId ?? null;
		const contactId = calendarEvent?.contactId ?? contact?.id ?? null;
		const project = companyId
			? await this.db.project.findFirst({
					where: {
						companyId,
						status: { in: ["ACTIVE", "PLANNING"] },
					},
					orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
					select: { id: true },
				})
			: null;
		const summaryText =
			transcript.summary?.overview ??
			transcript.summary?.short_summary ??
			transcript.summary?.gist ??
			"Meeting summary is available in Fireflies.";

		const summary = await this.db.meetingSummary.upsert({
			where: { firefliesTranscriptId: transcript.id },
			create: {
				firefliesTranscriptId: transcript.id,
				title: transcript.title?.trim() || "Client meeting",
				meetingAt,
				durationMinutes: durationMinutes(transcript.duration),
				organizerEmail: transcript.organizer_email?.toLowerCase() ?? null,
				participantEmails: participants,
				summary: summaryText,
				actionItems: jsonValue(transcript.summary?.action_items),
				keywords: transcript.summary?.keywords ?? [],
				transcriptUrl: transcript.transcript_url ?? null,
				visibility: companyId
					? MeetingVisibility.CLIENT
					: MeetingVisibility.INTERNAL,
				companyId,
				contactId,
				projectId: project?.id ?? null,
				calendarEventId: calendarEvent?.id ?? null,
			},
			update: {
				title: transcript.title?.trim() || "Client meeting",
				meetingAt,
				durationMinutes: durationMinutes(transcript.duration),
				organizerEmail: transcript.organizer_email?.toLowerCase() ?? null,
				participantEmails: participants,
				summary: summaryText,
				actionItems: jsonValue(transcript.summary?.action_items),
				keywords: transcript.summary?.keywords ?? [],
				transcriptUrl: transcript.transcript_url ?? null,
				companyId,
				contactId,
				projectId: project?.id ?? null,
				calendarEventId: calendarEvent?.id ?? null,
			},
		});

		if (calendarEvent?.activity?.id) {
			await this.db.activity.update({
				where: { id: calendarEvent.activity.id },
				data: { body: summaryText },
			});
		} else if (internalUsers[0]) {
			await this.db.activity.create({
				data: {
					type: ActivityType.MEETING,
					subject: summary.title,
					body: summaryText,
					occurredAt: meetingAt,
					companyId,
					contactId,
					createdById: internalUsers[0].id,
					meta: { source: "fireflies", transcriptId: transcript.id },
				},
			});
		}

		await this.createActionTasks(
			summary.id,
			project?.id ?? null,
			internalUsers[0]?.id,
		);
		return { id: summary.id, companyId, projectId: project?.id ?? null };
	}

	private async matchCalendarEvent(
		transcript: FirefliesTranscript,
		meetingAt: Date,
	) {
		const calendarIds = [transcript.cal_id, transcript.calendar_id].filter(
			(value): value is string => Boolean(value),
		);
		const from = new Date(meetingAt.getTime() - 12 * 60 * 60 * 1000);
		const to = new Date(meetingAt.getTime() + 12 * 60 * 60 * 1000);

		return this.db.calendarEvent.findFirst({
			where: {
				OR: [
					...(calendarIds.length
						? [{ googleEventId: { in: calendarIds } }]
						: []),
					{ startsAt: { gte: from, lte: to } },
				],
			},
			orderBy: { startsAt: "asc" },
			select: {
				id: true,
				companyId: true,
				contactId: true,
				activity: { select: { id: true } },
			},
		});
	}

	private async createActionTasks(
		meetingSummaryId: string,
		projectId: string | null,
		createdById: string | undefined,
	) {
		if (!projectId || !createdById) return;
		const existing = await this.db.projectTask.count({
			where: { meetingSummaryId },
		});
		if (existing > 0) return;
		const summary = await this.db.meetingSummary.findUnique({
			where: { id: meetingSummaryId },
			select: { actionItems: true },
		});
		const items = actionItems(summary?.actionItems);
		if (items.length === 0) return;

		await this.db.projectTask.createMany({
			data: items.map((title, position) => ({
				projectId,
				title,
				position,
				createdById,
				meetingSummaryId,
			})),
		});
	}
}

function normalizedEmails(transcript: FirefliesTranscript): string[] {
	return [transcript.organizer_email, ...(transcript.participants ?? [])]
		.filter((value): value is string => typeof value === "string")
		.map((value) => value.trim().toLowerCase())
		.filter(
			(value, index, values) =>
				value.includes("@") && values.indexOf(value) === index,
		);
}

function validDate(value: number | undefined): Date {
	const date = value ? new Date(value) : new Date();
	return Number.isNaN(date.getTime()) ? new Date() : date;
}

function durationMinutes(value: number | undefined): number | null {
	if (!value || !Number.isFinite(value)) return null;
	return Math.max(1, Math.round(value / 60));
}

function jsonValue(value: unknown) {
	return value === undefined ? undefined : (value as never);
}

function actionItems(value: unknown): string[] {
	const raw = Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: typeof value === "string"
			? value.split(/\r?\n/)
			: [];
	return raw
		.map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
		.filter((item) => item.length > 2)
		.slice(0, 20);
}
