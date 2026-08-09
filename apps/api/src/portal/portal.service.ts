import { isWorkspaceAdmin } from "@crm/auth";
import { type Db, MeetingVisibility } from "@crm/db";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type { z } from "zod";
import type { portalCompanyInput, portalGrantInput } from "./portal.contracts";

@Injectable()
export class PortalService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(companyId: string, actorId: string) {
		await this.assertAdmin(actorId);
		return this.db.clientPortalAccess.findMany({
			where: { companyId },
			orderBy: { invitedAt: "desc" },
			select: {
				id: true,
				email: true,
				active: true,
				invitedAt: true,
				lastAccessedAt: true,
				contact: {
					select: { id: true, firstName: true, lastName: true },
				},
			},
		});
	}

	async grant(input: z.infer<typeof portalGrantInput>, actorId: string) {
		await this.assertAdmin(actorId);
		if (input.contactId) {
			const contact = await this.db.contact.findFirst({
				where: { id: input.contactId, companyId: input.companyId },
				select: { id: true },
			});
			if (!contact) {
				throw new NotFoundException(
					"That contact does not belong to the company.",
				);
			}
		}

		const email = input.email.trim().toLowerCase();
		return this.db.clientPortalAccess.upsert({
			where: { email },
			create: {
				email,
				companyId: input.companyId,
				contactId: input.contactId ?? null,
			},
			update: {
				active: true,
				companyId: input.companyId,
				contactId: input.contactId ?? null,
				invitedAt: new Date(),
			},
			select: { id: true, email: true, active: true },
		});
	}

	async revoke(id: string, actorId: string) {
		await this.assertAdmin(actorId);
		try {
			return await this.db.clientPortalAccess.update({
				where: { id },
				data: { active: false },
				select: { id: true, email: true, active: true },
			});
		} catch {
			throw new NotFoundException("Portal access not found.");
		}
	}

	async mine(user: { id: string; email: string }) {
		const access = await this.db.clientPortalAccess.findFirst({
			where: { email: user.email.toLowerCase(), active: true },
			select: { id: true, companyId: true },
		});
		if (!access) {
			throw new ForbiddenException("No active client portal access.");
		}

		await this.db.clientPortalAccess.update({
			where: { id: access.id },
			data: { userId: user.id, lastAccessedAt: new Date() },
		});

		const company = await this.db.company.findUnique({
			where: { id: access.companyId },
			select: {
				id: true,
				name: true,
				logoUrl: true,
				projects: {
					orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
					select: {
						id: true,
						name: true,
						description: true,
						status: true,
						startDate: true,
						dueDate: true,
						tasks: {
							orderBy: [{ status: "asc" }, { position: "asc" }],
							select: {
								id: true,
								title: true,
								description: true,
								status: true,
								priority: true,
								dueDate: true,
							},
						},
					},
				},
				invoices: {
					orderBy: { issueDate: "desc" },
					select: {
						id: true,
						number: true,
						status: true,
						issueDate: true,
						dueDate: true,
						currency: true,
						total: true,
						amountPaid: true,
					},
				},
				calendarEvents: {
					where: { endsAt: { gte: new Date() } },
					orderBy: { startsAt: "asc" },
					take: 20,
					select: {
						id: true,
						title: true,
						startsAt: true,
						endsAt: true,
						conferenceUrl: true,
						location: true,
					},
				},
				meetingSummaries: {
					where: { visibility: MeetingVisibility.CLIENT },
					orderBy: { meetingAt: "desc" },
					take: 30,
					select: {
						id: true,
						title: true,
						meetingAt: true,
						durationMinutes: true,
						summary: true,
						actionItems: true,
						keywords: true,
						transcriptUrl: true,
						project: { select: { id: true, name: true } },
					},
				},
			},
		});
		if (!company) throw new NotFoundException("Client company not found.");

		return {
			...company,
			invoices: company.invoices.map(({ total, amountPaid, ...invoice }) => ({
				...invoice,
				totalCents: toCents(total) ?? 0,
				amountPaidCents: toCents(amountPaid) ?? 0,
			})),
		};
	}

	private async assertAdmin(userId: string) {
		const membership = await this.db.member.findFirst({
			where: { userId },
			select: { role: true },
		});
		if (!isWorkspaceAdmin(membership?.role as never)) {
			throw new ForbiddenException(
				"Workspace administrator access is required.",
			);
		}
	}
}
