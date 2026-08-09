import { type CatalogItemKind, type Db, type Prisma } from "@crm/db";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class CatalogService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: { q: string; kind?: CatalogItemKind | null }) {
		const term = input.q.trim();
		const where: Prisma.CatalogItemWhereInput = {
			active: true,
			...(input.kind ? { kind: input.kind } : {}),
			...(term
				? {
						OR: [
							{ name: { contains: term, mode: "insensitive" } },
							{ summary: { contains: term, mode: "insensitive" } },
							{ category: { contains: term, mode: "insensitive" } },
						],
					}
				: {}),
		};
		return this.db.catalogItem.findMany({
			where,
			orderBy: [{ position: "asc" }, { name: "asc" }],
		});
	}

	async create(input: {
		code: string;
		name: string;
		kind: CatalogItemKind;
		category: string;
		summary: string;
		sourceUrl: string;
	}) {
		return this.db.catalogItem.create({
			data: {
				...input,
				code: input.code.trim().toUpperCase(),
				name: input.name.trim(),
				category: input.category.trim(),
				summary: input.summary.trim(),
				outcomes: [],
				capabilities: [],
				measures: [],
			},
			select: { id: true, code: true, name: true },
		});
	}

	async delete(id: string) {
		const result = await this.db.catalogItem.deleteMany({ where: { id } });
		if (result.count === 0)
			throw new NotFoundException(`No catalog item with id ${id}.`);
		return { id };
	}
}
