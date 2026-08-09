import { type Db, RecordSource } from "@crm/db";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { assignedCompanyIds, staffRole } from "../authz/staff-scope";
import { toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { PortalService } from "../portal/portal.service";
import type {
	clientAccountInput,
	clientContactInput,
} from "./clients.contracts";

@Injectable()
export class ClientsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly portal: PortalService,
	) {}

	async list(
		q: string,
		actorId: string,
	): Promise<
		Array<{
			id: string;
			name: string;
			domain: string | null;
			logoUrl: string | null;
			industry: string | null;
			phone: string | null;
			email: string | null;
			primaryContact: {
				id: string;
				firstName: string;
				lastName: string | null;
				email: string | null;
			} | null;
			_count: {
				contacts: number;
				projects: number;
				invoices: number;
				deals: number;
				serviceRequests: number;
				portalAccesses: number;
			};
		}>
	> {
		const term = q.trim();
		const access = await staffRole(this.db, actorId);
		const companyIds = access.admin
			? null
			: await assignedCompanyIds(this.db, actorId);
		return this.db.company.findMany({
			where: {
				...(companyIds ? { id: { in: companyIds } } : {}),
				...(term
					? {
							OR: [
								{ name: { contains: term, mode: "insensitive" } },
								{ domain: { contains: term, mode: "insensitive" } },
							],
						}
					: {}),
			},
			orderBy: { name: "asc" },
			take: 250,
			select: {
				id: true,
				name: true,
				domain: true,
				logoUrl: true,
				industry: true,
				phone: true,
				email: true,
				primaryContact: {
					select: { id: true, firstName: true, lastName: true, email: true },
				},
				_count: {
					select: {
						contacts: true,
						projects: true,
						invoices: true,
						deals: true,
						serviceRequests: true,
						portalAccesses: true,
					},
				},
			},
		});
	}

	async detail(id: string, actorId: string) {
		const access = await staffRole(this.db, actorId);
		if (!access.admin) {
			const companyIds = await assignedCompanyIds(this.db, actorId);
			if (!companyIds.includes(id))
				throw new ForbiddenException("This client is not assigned to you.");
		}
		const company = await this.db.company.findUnique({
			where: { id },
			include: {
				contacts: {
					orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						title: true,
					},
				},
				portalAccesses: {
					orderBy: { invitedAt: "desc" },
					select: {
						id: true,
						email: true,
						active: true,
						invitedAt: true,
						lastAccessedAt: true,
						contactId: true,
					},
				},
				projects: {
					orderBy: { updatedAt: "desc" },
					take: 25,
					select: {
						id: true,
						name: true,
						status: true,
						dueDate: true,
						budget: true,
						currency: true,
						_count: { select: { tasks: true, invoices: true } },
					},
				},
				invoices: {
					orderBy: { issueDate: "desc" },
					take: 25,
					select: {
						id: true,
						number: true,
						status: true,
						total: true,
						amountPaid: true,
						currency: true,
						dueDate: true,
					},
				},
				deals: {
					orderBy: { createdAt: "desc" },
					take: 25,
					select: {
						id: true,
						name: true,
						stage: true,
						amount: true,
						currency: true,
					},
				},
				serviceRequests: {
					orderBy: { updatedAt: "desc" },
					take: 25,
					select: {
						id: true,
						reference: true,
						title: true,
						status: true,
						priority: true,
						updatedAt: true,
					},
				},
			},
		});
		if (!company) throw new NotFoundException("Client account not found.");
		return {
			...company,
			projects: company.projects.map(({ budget, ...project }) => ({
				...project,
				budgetCents: toCents(budget),
			})),
			invoices: company.invoices.map(({ total, amountPaid, ...invoice }) => ({
				...invoice,
				totalCents: toCents(total) ?? 0,
				amountPaidCents: toCents(amountPaid) ?? 0,
			})),
			deals: company.deals.map(({ amount, ...deal }) => ({
				...deal,
				amountCents: toCents(amount),
			})),
		};
	}

	async createAccount(
		input: z.infer<typeof clientAccountInput>,
		actorId: string,
	) {
		const access = await staffRole(this.db, actorId);
		const domain = normalizeDomain(input.domain);
		if (!domain)
			throw new ForbiddenException("Enter a valid client company domain.");
		if (await this.db.company.findUnique({ where: { domain } }))
			throw new ConflictException(`A client already uses ${domain}.`);
		this.validateClientEmail(input.contactEmail, domain);
		const created = await this.db.$transaction(async (tx) => {
			const company = await tx.company.create({
				data: {
					name: input.name,
					domain,
					website: `https://${domain}`,
					phone: input.phone || null,
					industry: input.industry || null,
					source: RecordSource.MANUAL,
				},
			});
			const contact = await tx.contact.create({
				data: {
					firstName: input.contactFirstName,
					lastName: input.contactLastName || null,
					email: input.contactEmail.toLowerCase(),
					phone: input.contactPhone || null,
					title: input.contactTitle || null,
					companyId: company.id,
					source: RecordSource.MANUAL,
				},
			});
			await tx.company.update({
				where: { id: company.id },
				data: { primaryContactId: contact.id, email: contact.email },
			});
			await tx.auditEntry.create({
				data: {
					entityType: "Company",
					entityId: company.id,
					action: "CREATE_CLIENT_ACCOUNT",
					actorId,
					summary: `Created client account ${company.name}`,
					after: { domain, primaryContactId: contact.id },
				},
			});
			return { company, contact };
		});
		const invitation =
			input.sendInvite && access.admin
				? await this.portal.grant(
						{
							companyId: created.company.id,
							contactId: created.contact.id,
							email: input.contactEmail,
						},
						actorId,
					)
				: null;
		if (input.sendInvite && !access.admin) {
			await this.db.auditEntry.create({
				data: {
					entityType: "Company",
					entityId: created.company.id,
					action: "CLIENT_ACTIVATION_PENDING_APPROVAL",
					actorId,
					summary: `Client activation requested for ${created.company.name}`,
				},
			});
		}
		return {
			companyId: created.company.id,
			contactId: created.contact.id,
			invitation,
			approvalRequired: input.sendInvite && !access.admin,
		};
	}

	async addContact(input: z.infer<typeof clientContactInput>, actorId: string) {
		const access = await staffRole(this.db, actorId);
		if (!access.admin) {
			const companyIds = await assignedCompanyIds(this.db, actorId);
			if (!companyIds.includes(input.companyId))
				throw new ForbiddenException("This client is not assigned to you.");
		}
		const company = await this.db.company.findUnique({
			where: { id: input.companyId },
			select: { id: true, name: true, domain: true },
		});
		if (!company) throw new NotFoundException("Client account not found.");
		this.validateClientEmail(input.email, company.domain);
		const contact = await this.db.contact.create({
			data: {
				firstName: input.firstName,
				lastName: input.lastName || null,
				email: input.email.toLowerCase(),
				phone: input.phone || null,
				title: input.title || null,
				companyId: company.id,
				source: RecordSource.MANUAL,
			},
		});
		if (input.primary)
			await this.db.company.update({
				where: { id: company.id },
				data: { primaryContactId: contact.id },
			});
		await this.db.auditEntry.create({
			data: {
				entityType: "Contact",
				entityId: contact.id,
				action: "CREATE_CLIENT_CONTACT",
				actorId,
				summary: `Added ${contact.firstName} to ${company.name}`,
				after: { companyId: company.id, primary: input.primary },
			},
		});
		const invitation =
			input.sendInvite && access.admin
				? await this.portal.grant(
						{
							companyId: company.id,
							contactId: contact.id,
							email: input.email,
						},
						actorId,
					)
				: null;
		if (input.sendInvite && !access.admin) {
			await this.db.auditEntry.create({
				data: {
					entityType: "Contact",
					entityId: contact.id,
					action: "CLIENT_ACCESS_PENDING_APPROVAL",
					actorId,
					summary: `Portal access requested for ${contact.email}`,
				},
			});
		}
		return {
			contact,
			invitation,
			approvalRequired: input.sendInvite && !access.admin,
		};
	}

	private validateClientEmail(email: string, companyDomain: string | null) {
		const domain = email.trim().toLowerCase().split("@")[1] ?? "";
		const allowed = companyDomain?.toLowerCase().replace(/^www\./, "") ?? "";
		if (
			domain !== "gmail.com" &&
			(!allowed || (domain !== allowed && !domain.endsWith(`.${allowed}`)))
		)
			throw new ForbiddenException(
				`Use a Gmail address or an address on ${allowed || "the client company domain"}.`,
			);
	}
}

function normalizeDomain(value: string) {
	const domain =
		value
			.trim()
			.toLowerCase()
			.replace(/^https?:\/\//, "")
			.replace(/^www\./, "")
			.split(/[/?#]/)[0] ?? "";
	return domain.includes(".") && !domain.includes("@") ? domain : null;
}
