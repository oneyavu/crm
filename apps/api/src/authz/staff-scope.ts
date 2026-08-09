import { isWorkspaceAdmin, WORKSPACE_ID } from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
import { ForbiddenException } from "@nestjs/common";

export async function staffRole(db: Db, userId: string) {
	const member = await db.member.findFirst({
		where: { userId, organizationId: WORKSPACE_ID },
		select: { role: true },
	});
	if (!member)
		throw new ForbiddenException("Staff workspace access is required.");
	return {
		role: member.role,
		admin: isWorkspaceAdmin(member.role as never),
	};
}

export async function assignedCompanyIds(db: Db, userId: string) {
	const [projects, createdAccounts] = await Promise.all([
		db.project.findMany({
			where: {
				companyId: { not: null },
				OR: [{ ownerId: userId }, { members: { some: { userId } } }],
			},
			select: { companyId: true },
		}),
		db.auditEntry.findMany({
			where: {
				entityType: "Company",
				action: "CREATE_CLIENT_ACCOUNT",
				actorId: userId,
			},
			select: { entityId: true },
		}),
	]);
	return [
		...new Set([
			...projects.flatMap((project) =>
				project.companyId ? [project.companyId] : [],
			),
			...createdAccounts.map((entry) => entry.entityId),
		]),
	];
}

export function assignedProjectWhere(userId: string): Prisma.ProjectWhereInput {
	return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

export function assignedInvoiceWhere(
	userId: string,
	companyIds: string[],
): Prisma.InvoiceWhereInput {
	return {
		OR: [
			{ createdById: userId },
			{ companyId: { in: companyIds } },
			{ project: assignedProjectWhere(userId) },
		],
	};
}
