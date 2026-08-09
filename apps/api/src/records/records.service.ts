import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import { Injectable, NotFoundException } from "@nestjs/common";
import { blankToNull, decimalFromCents, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import {
	countsByKey,
	FACET_ALL,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	RecordCreateInput,
	RecordListInput,
	RecordUpdateInput,
} from "./records.contracts";

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.BusinessRecordOrderByWithRelationInput
> = {
	reference: (dir) => ({ reference: { sort: dir, nulls: "last" } }),
	title: (dir) => ({ title: dir }),
	status: (dir) => ({ status: { sort: dir, nulls: "last" } }),
	amount: (dir) => ({ amount: { sort: dir, nulls: "last" } }),
	occurredAt: (dir) => ({ occurredAt: { sort: dir, nulls: "last" } }),
};

@Injectable()
export class RecordsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: RecordListInput) {
		const term = input.q.trim();
		const search: Prisma.BusinessRecordWhereInput = term
			? {
					OR: [
						{ title: { contains: term, mode: "insensitive" } },
						{ reference: { contains: term, mode: "insensitive" } },
						{ description: { contains: term, mode: "insensitive" } },
						{ company: { name: { contains: term, mode: "insensitive" } } },
					],
				}
			: {};
		const where: Prisma.BusinessRecordWhereInput = {
			...search,
			...(input.type !== FACET_ALL ? { type: input.type as never } : {}),
		};
		const { skip, take } = paginate(input);
		const [rows, total, types] = await Promise.all([
			this.db.businessRecord.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, { occurredAt: "desc" }),
				include: {
					company: { select: { id: true, name: true } },
					project: { select: { id: true, name: true } },
					category: { select: { id: true, name: true } },
					financialAccount: { select: { id: true, name: true } },
				},
			}),
			this.db.businessRecord.count({ where }),
			this.db.businessRecord.groupBy({
				by: ["type"],
				where: search,
				_count: { _all: true },
			}),
		]);
		return {
			rows: rows.map(({ amount, occurredAt, dueAt, ...row }) => ({
				...row,
				amountCents: toCents(amount),
				occurredAt: occurredAt?.toISOString() ?? null,
				dueAt: dueAt?.toISOString() ?? null,
			})),
			total,
			facetCounts: { type: countsByKey(types, "type") },
		};
	}

	async create(input: RecordCreateInput, actorId: string) {
		const record = await this.db.businessRecord.create({
			data: {
				...data(input),
			},
			select: { id: true, title: true, type: true, updatedAt: true },
		});
		await this.audit(
			record.id,
			"CREATE",
			actorId,
			`Created ${record.type.toLowerCase()} ${record.title}`,
			null,
			record,
		);
		return record;
	}

	async update(input: RecordUpdateInput, actorId: string) {
		const before = await this.db.businessRecord.findUnique({
			where: { id: input.id },
		});
		if (!before)
			throw new NotFoundException(`No business record with id ${input.id}.`);
		const record = await this.db.businessRecord.update({
			where: { id: input.id },
			data: data(input),
		});
		await this.audit(
			record.id,
			"UPDATE",
			actorId,
			`Updated ${record.type.toLowerCase()} ${record.title}`,
			before,
			record,
		);
		return {
			id: record.id,
			title: record.title,
			type: record.type,
			updatedAt: record.updatedAt,
		};
	}

	async delete(id: string, actorId: string) {
		try {
			const record = await this.db.businessRecord.delete({
				where: { id },
				select: { id: true, title: true, type: true },
			});
			await this.audit(
				record.id,
				"DELETE",
				actorId,
				`Deleted ${record.type.toLowerCase()} ${record.title}`,
				record,
				null,
			);
			return record;
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No business record with id ${id}.`);
			}
			throw error;
		}
	}

	private audit(
		entityId: string,
		action: string,
		actorId: string,
		summary: string,
		before: unknown,
		after: unknown,
	) {
		return this.db.auditEntry.create({
			data: {
				entityType: "BusinessRecord",
				entityId,
				action,
				actorId,
				summary,
				before: before == null ? undefined : json(before),
				after: after == null ? undefined : json(after),
			},
		});
	}
}

function json(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function data(input: RecordCreateInput) {
	return {
		type: input.type,
		reference: blankToNull(input.reference ?? ""),
		title: input.title.trim(),
		status: blankToNull(input.status ?? ""),
		description: blankToNull(input.description ?? ""),
		amount: decimalFromCents(input.amountCents),
		currency: input.currency || null,
		occurredAt: date(input.occurredAt),
		dueAt: date(input.dueAt),
		companyId: input.companyId || null,
		projectId: input.projectId || null,
		includedInFinancials: input.includedInFinancials,
		billable: input.billable,
		clientVisible: input.clientVisible,
		expenseScope: input.expenseScope || null,
		categoryId: input.categoryId || null,
		financialAccountId: input.financialAccountId || null,
	};
}

function date(value: string | null | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
