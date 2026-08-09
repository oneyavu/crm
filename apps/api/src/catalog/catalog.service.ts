import { type CatalogItemKind, type Db, type Prisma } from "@crm/db";
import { Injectable } from "@nestjs/common";
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
}
