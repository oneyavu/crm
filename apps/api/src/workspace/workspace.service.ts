import {
	canChangeRole,
	canRenameWorkspace,
	ensureWorkspaceMembership,
	isWorkspaceRole,
	WORKSPACE_ID,
	type WorkspaceRole,
} from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
import { isOnboarded, markOnboarded, workspaceSlug } from "@crm/db/workspace";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { normalizeDomain } from "../companies/domain";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import { NotificationsService } from "../notifications/notifications.service";
import {
	countsByKey,
	FACET_ALL,
	type ListResult,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	InviteMemberInput,
	MemberListInput,
	SetMemberRoleInput,
	UpdateWorkspaceInput,
} from "./workspace.contracts";

export interface Workspace {
	id: string;
	slug: string;
	name: string;
	website: string | null;
	onboarded: boolean;
	viewerRole: WorkspaceRole | null;
	canRename: boolean;
	canChangeRoles: boolean;
	permissions: {
		manageWorkspace: boolean;
		accessBanking: boolean;
		manageAgents: boolean;
	};
}

export interface WorkspaceMember {
	id: string;
	userId: string;
	name: string;
	email: string;
	image: string | null;
	role: WorkspaceRole;
	joinedAt: string;
	isViewer: boolean;
}

const MEMBER_SELECT = {
	id: true,
	role: true,
	createdAt: true,
	userId: true,
	user: { select: { name: true, email: true, image: true } },
} as const;

type MemberRow = Prisma.MemberGetPayload<{ select: typeof MEMBER_SELECT }>;

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.MemberOrderByWithRelationInput
> = {
	name: (dir) => ({ user: { name: dir } }),
	email: (dir) => ({ user: { email: dir } }),
	role: (dir) => ({ role: dir }),
	joinedAt: (dir) => ({ createdAt: dir }),
};

function toRole(value: string): WorkspaceRole {
	return isWorkspaceRole(value) ? value : "member";
}

@Injectable()
export class WorkspaceService {
	private readonly logger = new Logger(WorkspaceService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly notifications: NotificationsService,
		private readonly config: ConfigService<EnvironmentVariables, true>,
	) {}

	async get(userId: string): Promise<Workspace> {
		let row = await this.readWorkspace();

		if (!row) {
			await ensureWorkspaceMembership(userId);
			row = await this.readWorkspace();
		}

		if (!row) {
			throw new ServiceUnavailableException(
				"The workspace could not be read. Sign in again in a moment.",
			);
		}

		const role = await this.roleOf(userId);

		return {
			id: row.id,
			slug: row.slug,
			name: row.name,
			website: row.website,
			onboarded: isOnboarded(row.metadata),
			viewerRole: role,
			canRename: canRenameWorkspace(role),
			canChangeRoles: canChangeRole(role),
			permissions: {
				manageWorkspace: canChangeRole(role),
				accessBanking: canChangeRole(role),
				manageAgents: canChangeRole(role),
			},
		};
	}

	async update(
		userId: string,
		input: UpdateWorkspaceInput,
	): Promise<Workspace> {
		const role = await this.roleOf(userId);

		if (!canRenameWorkspace(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change the workspace.",
			);
		}

		const before = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { website: true, metadata: true },
		});

		const website = normalizeDomain(input.website);

		if (!website) {
			throw new BadRequestException(
				"That is not a website. Enter the domain, like acme.com.",
			);
		}

		await this.db.organization.update({
			where: { id: WORKSPACE_ID },
			data: {
				name: input.name,
				slug: workspaceSlug(input.slug ?? input.name),
				website,
				metadata: markOnboarded(before?.metadata ?? null, new Date()),
			},
		});

		this.logger.log({ message: "Workspace updated", userId });

		if (website !== before?.website) {
			await this.agent.workspaceChanged(
				website,
				before?.website
					? "The company using this CRM changed its website"
					: "The company using this CRM said what its website is",
			);
		}

		return this.get(userId);
	}

	async members(
		userId: string,
		input: MemberListInput,
	): Promise<ListResult<WorkspaceMember>> {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, roles] = await Promise.all([
			this.db.member.findMany({
				where,
				skip,
				take,
				select: MEMBER_SELECT,
				orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "asc" }),
			}),
			this.db.member.count({ where }),
			this.db.member.groupBy({
				by: ["role"],
				where: this.searchWhere(input.q),
				_count: { _all: true },
			}),
		]);

		return {
			rows: rows.map((row) => this.toMember(row, userId)),
			total,
			facetCounts: { role: countsByKey(roles, "role") },
		};
	}

	async setMemberRole(
		userId: string,
		input: SetMemberRoleInput,
	): Promise<WorkspaceMember> {
		const role = await this.roleOf(userId);

		if (!canChangeRole(role)) {
			throw new ForbiddenException(
				"Only an owner or an admin can change a member's role.",
			);
		}

		const updated = await this.db.$transaction(async (tx) => {
			const target = await tx.member.findFirst({
				where: { id: input.memberId, organizationId: WORKSPACE_ID },
				select: { id: true, role: true },
			});

			if (!target) {
				throw new NotFoundException("That person is not in this workspace.");
			}

			if (target.role === "owner" && input.role !== "owner") {
				const owners = await tx.$queryRaw<{ id: string }[]>`
					SELECT id FROM "member"
					WHERE "organizationId" = ${WORKSPACE_ID} AND role = 'owner'
					FOR UPDATE
				`;

				if (owners.length <= 1) {
					throw new ForbiddenException(
						"The workspace needs an owner. Make someone else an owner first.",
					);
				}
			}

			return tx.member.update({
				where: { id: target.id },
				data: { role: input.role },
				select: MEMBER_SELECT,
			});
		});

		this.logger.log({
			message: "Workspace role changed",
			userId,
			memberId: updated.id,
			role: input.role,
		});

		return this.toMember(updated, userId);
	}

	async invitations(userId: string) {
		await this.assertRoleManager(userId);
		const rows = await this.db.invitation.findMany({
			where: { organizationId: WORKSPACE_ID, status: "pending" },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				email: true,
				role: true,
				createdAt: true,
				expiresAt: true,
			},
		});
		return rows.map((row) => ({
			...row,
			role: toRole(row.role ?? "member"),
			createdAt: row.createdAt.toISOString(),
			expiresAt: row.expiresAt.toISOString(),
		}));
	}

	async removeMember(userId: string, memberId: string) {
		await this.assertRoleManager(userId);
		const removed = await this.db.$transaction(async (tx) => {
			const target = await tx.member.findFirst({
				where: { id: memberId, organizationId: WORKSPACE_ID },
				select: {
					id: true,
					userId: true,
					role: true,
					user: { select: { name: true, email: true } },
				},
			});
			if (!target)
				throw new NotFoundException(
					"That staff member is not in this workspace.",
				);
			if (target.userId === userId)
				throw new ForbiddenException(
					"You cannot remove your own staff access.",
				);
			if (target.role === "owner") {
				const ownerCount = await tx.member.count({
					where: { organizationId: WORKSPACE_ID, role: "owner" },
				});
				if (ownerCount <= 1)
					throw new ForbiddenException("The workspace must retain an owner.");
			}
			await tx.projectMember.deleteMany({ where: { userId: target.userId } });
			await tx.projectTask.updateMany({
				where: { assigneeId: target.userId },
				data: { assigneeId: null },
			});
			await tx.staffProfile.updateMany({
				where: { userId: target.userId },
				data: { active: false },
			});
			await tx.member.delete({ where: { id: target.id } });
			await tx.auditEntry.create({
				data: {
					entityType: "StaffMember",
					entityId: target.id,
					action: "REMOVE",
					actorId: userId,
					summary: `Removed staff access for ${target.user.name} (${target.user.email})`,
				},
			});
			return target;
		});
		this.logger.log({
			message: "Staff member removed",
			userId,
			memberId,
			removedUserId: removed.userId,
		});
		return {
			id: removed.id,
			name: removed.user.name,
			email: removed.user.email,
		};
	}

	async inviteMember(userId: string, input: InviteMemberInput) {
		await this.assertRoleManager(userId);
		const email = input.email.trim().toLowerCase();
		const existing = await this.db.member.findFirst({
			where: { organizationId: WORKSPACE_ID, user: { email } },
			select: { id: true },
		});
		if (existing)
			throw new BadRequestException("That person already has CRM access.");

		await this.db.invitation.updateMany({
			where: { organizationId: WORKSPACE_ID, email, status: "pending" },
			data: { status: "cancelled" },
		});
		const invitation = await this.db.invitation.create({
			data: {
				id: randomUUID(),
				organizationId: WORKSPACE_ID,
				email,
				role: input.role,
				status: "pending",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				inviterId: userId,
			},
			select: { id: true, email: true, role: true, expiresAt: true },
		});
		const url = `${this.appUrl()}/accept-invite?type=staff&token=${invitation.id}&email=${encodeURIComponent(email)}`;
		const delivery = await this.notifications.sendEmail({
			toEmail: email,
			subject: "You are invited to VAYU CRM",
			html: inviteHtml(
				"Join the VAYU team",
				`You have been invited as ${input.role}.`,
				url,
			),
		});
		return {
			...invitation,
			expiresAt: invitation.expiresAt.toISOString(),
			delivery,
		};
	}

	async revokeInvitation(userId: string, id: string) {
		await this.assertRoleManager(userId);
		const result = await this.db.invitation.updateMany({
			where: { id, organizationId: WORKSPACE_ID, status: "pending" },
			data: { status: "cancelled" },
		});
		if (!result.count) throw new NotFoundException("Invitation not found.");
		return { id };
	}

	async acceptInvitation(user: { id: string; email: string }, id: string) {
		const invitation = await this.db.invitation.findFirst({
			where: { id, organizationId: WORKSPACE_ID, status: "pending" },
			select: { id: true, email: true, role: true, expiresAt: true },
		});
		if (!invitation || invitation.expiresAt <= new Date())
			throw new NotFoundException("This invitation is invalid or has expired.");
		if (invitation.email !== user.email.trim().toLowerCase())
			throw new ForbiddenException(
				"Sign in with the email address that was invited.",
			);
		await this.db.$transaction([
			this.db.member.upsert({
				where: {
					organizationId_userId: {
						organizationId: WORKSPACE_ID,
						userId: user.id,
					},
				},
				create: {
					id: randomUUID(),
					organizationId: WORKSPACE_ID,
					userId: user.id,
					role: invitation.role ?? "member",
					createdAt: new Date(),
				},
				update: { role: invitation.role ?? "member" },
			}),
			this.db.invitation.update({
				where: { id },
				data: { status: "accepted" },
			}),
		]);
		return { accepted: true };
	}

	private async assertRoleManager(userId: string) {
		if (!canChangeRole(await this.roleOf(userId)))
			throw new ForbiddenException(
				"Only an owner or admin can manage invitations.",
			);
	}

	private appUrl(): string {
		return (
			(this.config.get("APP_URL", { infer: true }) ?? "http://localhost:3000")
				.split(",")[0]
				?.trim() ?? "http://localhost:3000"
		);
	}

	private toMember(row: MemberRow, userId: string): WorkspaceMember {
		return {
			id: row.id,
			userId: row.userId,
			name: row.user.name,
			email: row.user.email,
			image: row.user.image,
			role: toRole(row.role),
			joinedAt: row.createdAt.toISOString(),
			isViewer: row.userId === userId,
		};
	}

	private searchWhere(q: string): Prisma.MemberWhereInput {
		const term = q.trim();
		const where: Prisma.MemberWhereInput = { organizationId: WORKSPACE_ID };

		if (term) {
			where.user = {
				OR: [
					{ name: { contains: term, mode: "insensitive" } },
					{ email: { contains: term, mode: "insensitive" } },
				],
			};
		}

		return where;
	}

	private buildWhere(input: MemberListInput): Prisma.MemberWhereInput {
		const where = this.searchWhere(input.q);

		if (input.role !== FACET_ALL) {
			where.role = input.role;
		}

		return where;
	}

	private async readWorkspace() {
		return this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: {
				id: true,
				slug: true,
				name: true,
				website: true,
				metadata: true,
			},
		});
	}

	private async roleOf(userId: string): Promise<WorkspaceRole | null> {
		const member = await this.db.member.findUnique({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId },
			},
			select: { role: true },
		});

		return member ? toRole(member.role) : null;
	}
}

function inviteHtml(title: string, message: string, url: string): string {
	return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px"><p style="color:#3b7f34;font-weight:700">VAYU CRM</p><h1 style="font-size:24px">${title}</h1><p>${message}</p><p><a href="${url}" style="display:inline-block;background:#65df55;color:#071207;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:700">Accept invitation</a></p><p style="color:#666;font-size:13px">This invitation expires in 7 days.</p></div>`;
}

import { randomUUID } from "node:crypto";
