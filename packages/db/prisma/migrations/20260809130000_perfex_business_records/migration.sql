CREATE TYPE "BusinessRecordType" AS ENUM ('ESTIMATE', 'EXPENSE', 'CONTRACT', 'TICKET', 'STAFF', 'TASK', 'NOTE', 'PAYMENT');

CREATE TABLE "businessRecord" (
    "id" TEXT NOT NULL,
    "type" "BusinessRecordType" NOT NULL,
    "reference" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT,
    "description" TEXT,
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "occurredAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "companyId" TEXT,
    "contactId" TEXT,
    "projectId" TEXT,
    "invoiceId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "businessRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "externalRecordLink" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "externalRecordLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "businessRecord_source_type_sourceId_key" ON "businessRecord"("source", "type", "sourceId");
CREATE INDEX "businessRecord_type_occurredAt_idx" ON "businessRecord"("type", "occurredAt");
CREATE INDEX "businessRecord_companyId_idx" ON "businessRecord"("companyId");
CREATE INDEX "businessRecord_projectId_idx" ON "businessRecord"("projectId");
CREATE UNIQUE INDEX "externalRecordLink_source_sourceTable_sourceId_key" ON "externalRecordLink"("source", "sourceTable", "sourceId");
CREATE INDEX "externalRecordLink_entityType_entityId_idx" ON "externalRecordLink"("entityType", "entityId");

ALTER TABLE "businessRecord" ADD CONSTRAINT "businessRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "businessRecord" ADD CONSTRAINT "businessRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "businessRecord" ADD CONSTRAINT "businessRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "businessRecord" ADD CONSTRAINT "businessRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
