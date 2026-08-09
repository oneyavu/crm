-- CreateEnum
CREATE TYPE "ExpenseScope" AS ENUM ('COMPANY', 'CLIENT', 'PROJECT');

-- CreateEnum
CREATE TYPE "FinancialAccountKind" AS ENUM ('OPERATING', 'SAVINGS', 'CREDIT_CARD', 'MERCHANT', 'STRIPE', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageTemplateKind" AS ENUM ('EMAIL', 'SUGGESTED_REPLY');

-- CreateEnum
CREATE TYPE "MetricPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BusinessDocumentKind" AS ENUM ('ANNUAL_FILING', 'TAX', 'ORC', 'TCC', 'CERTIFICATE', 'LICENSE', 'CONTRACT', 'MSA', 'COMPANY_STAMP', 'AUTHORIZED_SIGNATURE', 'DIRECTOR_RECORD', 'INVESTOR_AGREEMENT', 'POLICY', 'OTHER');

-- AlterTable
ALTER TABLE "businessRecord" ADD COLUMN     "billable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "clientVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expenseScope" "ExpenseScope",
ADD COLUMN     "financialAccountId" TEXT,
ADD COLUMN     "includedInFinancials" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "expenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messageTemplate" (
    "id" TEXT NOT NULL,
    "kind" "MessageTemplateKind" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financialAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinancialAccountKind" NOT NULL,
    "institution" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "lastFour" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogCostProfile" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "implementationCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deliveryCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyRunCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyHostingCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "contractorCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "internalHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "targetMarginPct" DECIMAL(6,2) NOT NULL DEFAULT 35,
    "listPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogCostProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "employmentType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "contractSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffCompensationPlan" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "baseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "bonusFormula" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffCompensationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffMetric" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "period" "MetricPeriod" NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" DECIMAL(14,2),
    "actual" DECIMAL(14,2),
    "unit" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeEntry" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT,
    "staffUserId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "description" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "hourlyCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "hourlyBillRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "clientVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectResourceUsage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "agentId" TEXT,
    "label" TEXT NOT NULL,
    "processingMs" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectResourceUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businessDocument" (
    "id" TEXT NOT NULL,
    "kind" "BusinessDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "projectId" TEXT,
    "fileName" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businessDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditEntry" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expenseCategory_name_key" ON "expenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expenseCategory_source_sourceId_key" ON "expenseCategory"("source", "sourceId");

-- CreateIndex
CREATE INDEX "messageTemplate_kind_active_idx" ON "messageTemplate"("kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "messageTemplate_source_kind_sourceId_key" ON "messageTemplate"("source", "kind", "sourceId");

-- CreateIndex
CREATE INDEX "financialAccount_kind_active_idx" ON "financialAccount"("kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "catalogCostProfile_catalogItemId_key" ON "catalogCostProfile"("catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "staffProfile_userId_key" ON "staffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staffProfile_email_key" ON "staffProfile"("email");

-- CreateIndex
CREATE INDEX "staffProfile_active_department_idx" ON "staffProfile"("active", "department");

-- CreateIndex
CREATE INDEX "staffCompensationPlan_staffProfileId_active_idx" ON "staffCompensationPlan"("staffProfileId", "active");

-- CreateIndex
CREATE INDEX "staffMetric_staffProfileId_periodStart_idx" ON "staffMetric"("staffProfileId", "periodStart");

-- CreateIndex
CREATE INDEX "staffMetric_period_status_idx" ON "staffMetric"("period", "status");

-- CreateIndex
CREATE INDEX "timeEntry_projectId_startedAt_idx" ON "timeEntry"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "timeEntry_staffProfileId_startedAt_idx" ON "timeEntry"("staffProfileId", "startedAt");

-- CreateIndex
CREATE INDEX "projectMilestone_projectId_position_idx" ON "projectMilestone"("projectId", "position");

-- CreateIndex
CREATE INDEX "projectResourceUsage_projectId_occurredAt_idx" ON "projectResourceUsage"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "projectResourceUsage_agentId_occurredAt_idx" ON "projectResourceUsage"("agentId", "occurredAt");

-- CreateIndex
CREATE INDEX "businessDocument_kind_updatedAt_idx" ON "businessDocument"("kind", "updatedAt");

-- CreateIndex
CREATE INDEX "businessDocument_projectId_updatedAt_idx" ON "businessDocument"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "auditEntry_entityType_entityId_createdAt_idx" ON "auditEntry"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "auditEntry_actorId_createdAt_idx" ON "auditEntry"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "businessRecord_categoryId_idx" ON "businessRecord"("categoryId");

-- CreateIndex
CREATE INDEX "businessRecord_financialAccountId_idx" ON "businessRecord"("financialAccountId");

-- CreateIndex
CREATE INDEX "businessRecord_includedInFinancials_type_idx" ON "businessRecord"("includedInFinancials", "type");

-- AddForeignKey
ALTER TABLE "businessRecord" ADD CONSTRAINT "businessRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businessRecord" ADD CONSTRAINT "businessRecord_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogCostProfile" ADD CONSTRAINT "catalogCostProfile_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffProfile" ADD CONSTRAINT "staffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffCompensationPlan" ADD CONSTRAINT "staffCompensationPlan_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffMetric" ADD CONSTRAINT "staffMetric_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeEntry" ADD CONSTRAINT "timeEntry_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeEntry" ADD CONSTRAINT "timeEntry_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeEntry" ADD CONSTRAINT "timeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectMilestone" ADD CONSTRAINT "projectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectResourceUsage" ADD CONSTRAINT "projectResourceUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businessDocument" ADD CONSTRAINT "businessDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
