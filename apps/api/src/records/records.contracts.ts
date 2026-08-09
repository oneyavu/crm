import { BusinessRecordType } from "@crm/db";
import { z } from "zod";
import { currencyCode } from "../currency/currency.contracts";
import { listInput } from "../trpc/list-input";

const recordType = z.enum(
	Object.values(BusinessRecordType) as [
		BusinessRecordType,
		...BusinessRecordType[],
	],
);

export const recordListInput = listInput.extend({
	type: z.string().default("all"),
});
export type RecordListInput = z.infer<typeof recordListInput>;

export const recordIdInput = z.object({ id: z.string().min(1) });

export const recordCreateInput = z.object({
	type: recordType,
	reference: z.string().trim().nullable().optional(),
	title: z.string().trim().min(1, "A record needs a title."),
	status: z.string().trim().nullable().optional(),
	description: z.string().trim().nullable().optional(),
	amountCents: z.number().int().min(0).nullable().optional(),
	currency: currencyCode.nullable().optional(),
	occurredAt: z.string().nullable().optional(),
	dueAt: z.string().nullable().optional(),
	companyId: z.string().nullable().optional(),
	projectId: z.string().nullable().optional(),
	includedInFinancials: z.boolean().default(true),
	billable: z.boolean().default(false),
	clientVisible: z.boolean().default(false),
	expenseScope: z.enum(["COMPANY", "CLIENT", "PROJECT"]).nullable().optional(),
	categoryId: z.string().nullable().optional(),
	financialAccountId: z.string().nullable().optional(),
});
export type RecordCreateInput = z.infer<typeof recordCreateInput>;

export const recordUpdateInput = recordCreateInput.extend({
	id: z.string().min(1),
});
export type RecordUpdateInput = z.infer<typeof recordUpdateInput>;
