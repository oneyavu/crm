import { type Db, EmailDeliveryStatus, NotificationType } from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";

type RecordLinks = {
	projectId?: string;
	taskId?: string;
	invoiceId?: string;
};

type NotifyUserInput = RecordLinks & {
	userId: string;
	type: NotificationType;
	title: string;
	body: string;
	href?: string;
};

type QueueEmailInput = {
	toEmail: string;
	subject: string;
	html: string;
	invoiceId?: string;
};

@Injectable()
export class NotificationsService {
	private readonly logger = new Logger(NotificationsService.name);
	private readonly apiKey: string | undefined;
	private readonly from: string | undefined;
	private readonly appUrl: string;

	constructor(
		@InjectDatabase() private readonly db: Db,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.apiKey = blank(config.get("RESEND_API_KEY", { infer: true }));
		this.from = blank(config.get("NOTIFICATION_EMAIL_FROM", { infer: true }));
		this.appUrl = firstOrigin(
			config.get("APP_URL", { infer: true }) ?? "http://localhost:3000",
		);
	}

	async list(userId: string, limit: number) {
		const [rows, unread] = await Promise.all([
			this.db.notification.findMany({
				where: { userId },
				take: limit,
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					type: true,
					title: true,
					body: true,
					href: true,
					readAt: true,
					createdAt: true,
				},
			}),
			this.db.notification.count({ where: { userId, readAt: null } }),
		]);

		return {
			rows: rows.map((row) => ({
				...row,
				readAt: row.readAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
			})),
			unread,
		};
	}

	async unreadCount(userId: string) {
		return {
			count: await this.db.notification.count({
				where: { userId, readAt: null },
			}),
		};
	}

	async markRead(userId: string, id: string) {
		const result = await this.db.notification.updateMany({
			where: { id, userId, readAt: null },
			data: { readAt: new Date() },
		});
		return { updated: result.count > 0 };
	}

	async markAllRead(userId: string) {
		const result = await this.db.notification.updateMany({
			where: { userId, readAt: null },
			data: { readAt: new Date() },
		});
		return { updated: result.count };
	}

	async notifyUser(input: NotifyUserInput) {
		const user = await this.db.user.findUnique({
			where: { id: input.userId },
			select: { email: true },
		});
		if (!user) return null;

		const href = input.href ? absoluteUrl(this.appUrl, input.href) : undefined;
		const notification = await this.db.notification.create({
			data: {
				userId: input.userId,
				type: input.type,
				title: input.title,
				body: input.body,
				href: input.href,
				projectId: input.projectId,
				taskId: input.taskId,
				invoiceId: input.invoiceId,
				delivery: {
					create: {
						toEmail: user.email,
						subject: input.title,
						html: notificationHtml(input.title, input.body, href),
						invoiceId: input.invoiceId,
						status: this.configured()
							? EmailDeliveryStatus.PENDING
							: EmailDeliveryStatus.SKIPPED,
					},
				},
			},
			select: { id: true, delivery: { select: { id: true, status: true } } },
		});

		if (notification.delivery?.status === EmailDeliveryStatus.PENDING) {
			await this.dispatchOne(notification.delivery.id);
		}

		return notification.id;
	}

	async sendEmail(input: QueueEmailInput) {
		const delivery = await this.db.emailDelivery.create({
			data: {
				toEmail: input.toEmail,
				subject: input.subject,
				html: input.html,
				invoiceId: input.invoiceId,
				status: this.configured()
					? EmailDeliveryStatus.PENDING
					: EmailDeliveryStatus.SKIPPED,
			},
			select: { id: true, status: true },
		});

		if (delivery.status === EmailDeliveryStatus.SKIPPED) {
			return { sent: false as const, reason: "not-configured" as const };
		}

		const sent = await this.dispatchOne(delivery.id);
		return sent
			? { sent: true as const }
			: { sent: false as const, reason: "delivery-failed" as const };
	}

	async dispatchDue() {
		if (!this.configured()) return { sent: 0, failed: 0, skipped: true };

		const rows = await this.db.emailDelivery.findMany({
			where: {
				status: {
					in: [EmailDeliveryStatus.PENDING, EmailDeliveryStatus.FAILED],
				},
				attempts: { lt: 5 },
				nextAttemptAt: { lte: new Date() },
			},
			take: 50,
			orderBy: { createdAt: "asc" },
			select: { id: true },
		});

		const results = await Promise.all(
			rows.map((row) => this.dispatchOne(row.id)),
		);
		const sent = results.filter(Boolean).length;
		return { sent, failed: results.length - sent, skipped: false };
	}

	private configured(): boolean {
		return Boolean(this.apiKey && this.from);
	}

	private async dispatchOne(id: string): Promise<boolean> {
		if (!this.apiKey || !this.from) return false;

		const claimed = await this.db.emailDelivery.updateMany({
			where: {
				id,
				status: {
					in: [EmailDeliveryStatus.PENDING, EmailDeliveryStatus.FAILED],
				},
				attempts: { lt: 5 },
			},
			data: {
				status: EmailDeliveryStatus.SENDING,
				attempts: { increment: 1 },
				lastError: null,
			},
		});
		if (claimed.count === 0) return false;

		const delivery = await this.db.emailDelivery.findUnique({
			where: { id },
			select: {
				toEmail: true,
				subject: true,
				html: true,
				attempts: true,
			},
		});
		if (!delivery) return false;

		try {
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
					"Idempotency-Key": id,
				},
				body: JSON.stringify({
					from: this.from,
					to: [delivery.toEmail],
					subject: delivery.subject,
					html: delivery.html,
				}),
				signal: AbortSignal.timeout(6000),
			});

			if (!response.ok) {
				throw new Error(`Resend returned ${response.status}.`);
			}

			const payload = (await response.json()) as { id?: string };
			await this.db.emailDelivery.update({
				where: { id },
				data: {
					status: EmailDeliveryStatus.SENT,
					providerId: payload.id ?? null,
					sentAt: new Date(),
				},
			});
			this.logger.log({ message: "Email notification sent", deliveryId: id });
			return true;
		} catch (error) {
			const delayMinutes = Math.min(60, 2 ** delivery.attempts);
			await this.db.emailDelivery.update({
				where: { id },
				data: {
					status: EmailDeliveryStatus.FAILED,
					lastError:
						error instanceof Error ? error.message : "Delivery failed.",
					nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
				},
			});
			this.logger.warn({
				message: "Email notification failed",
				deliveryId: id,
			});
			return false;
		}
	}
}

export function notificationHtml(
	title: string,
	body: string,
	href?: string,
): string {
	const action = href
		? `<p><a href="${escapeHtml(href)}">Open in CRM</a></p>`
		: "";
	return `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>${action}`;
}

function absoluteUrl(origin: string, href: string): string {
	return new URL(href, `${origin}/`).toString();
}

function firstOrigin(value: string): string {
	return (
		value.split(",")[0]?.trim().replace(/\/$/, "") || "http://localhost:3000"
	);
}

function blank(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}
