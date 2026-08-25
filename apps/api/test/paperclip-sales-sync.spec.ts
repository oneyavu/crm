import { describe, expect, mock, test } from "bun:test";
import type { Db } from "@crm/db";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../src/config/env.validation";
import { PaperclipService } from "../src/paperclip/paperclip.service";

describe("Paperclip sales synchronization contract", () => {
	test("publishes a bounded CRM sales snapshot with a stable revision", async () => {
		const updatedAt = new Date("2026-08-21T12:00:00.000Z");
		const db = {
			company: {
				findMany: mock(async () => [
					{
						id: "company-1",
						name: "Example Client",
						domain: "example.com",
						ownerId: null,
						primaryContactId: null,
						source: "MANUAL",
						lastActivityAt: null,
						createdAt: updatedAt,
						updatedAt,
					},
				]),
			},
			contact: { findMany: mock(async () => []) },
			deal: {
				findMany: mock(async () => [
					{
						id: "deal-1",
						name: "V-OS deployment",
						companyId: "company-1",
						ownerId: "user-1",
						stage: "PROPOSAL",
						amount: { toString: () => "25000" },
						currency: "USD",
						expectedCloseDate: null,
						closedAt: null,
						updatedAt,
					},
				]),
			},
			activity: { findMany: mock(async () => []) },
			inquiry: { findMany: mock(async () => []) },
			project: { findMany: mock(async () => []) },
			invoice: { findMany: mock(async () => []) },
			businessRecord: { findMany: mock(async () => []) },
			projectMilestone: { findMany: mock(async () => []) },
			catalogItem: { findMany: mock(async () => []) },
		} as unknown as Db;
		const config = { get: () => undefined } as unknown as ConfigService<
			EnvironmentVariables,
			true
		>;
		const service = new PaperclipService(db, config);

		const snapshot = await service.bridgeSalesSnapshot();
		expect(snapshot.schemaVersion).toBe(1);
		expect(snapshot.objective.key).toBe("sell-v-os");
		expect(snapshot.metrics).toMatchObject({
			companies: 1,
			openDeals: 1,
			pipelineValue: "25000",
			currency: "USD",
		});
		expect(snapshot.revision).toBeTruthy();
		expect(snapshot.deals[0]).toMatchObject({ id: "deal-1", amount: "25000" });
	});
});
