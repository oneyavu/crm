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
import type { RecordCreateInput, RecordListInput } from "./records.contracts";

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

	async create(input: RecordCreateInput) {
		return this.db.businessRecord.create({
			data: {
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
			},
			select: { id: true, title: true, type: true },
		});
	}

	async delete(id: string) {
		try {
			return await this.db.businessRecord.delete({
				where: { id },
				select: { id: true, title: true },
			});
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
}

function date(value: string | null | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
