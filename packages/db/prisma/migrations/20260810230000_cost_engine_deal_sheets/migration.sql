ALTER TABLE "catalogCostProfile"
ADD COLUMN "baseCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "pricingUnit" TEXT NOT NULL DEFAULT 'engagement';

CREATE TABLE "costingCriterion" (
    "id" TEXT NOT NULL,
    "catalogCostProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PER_UNIT',
    "unitLabel" TEXT NOT NULL DEFAULT 'unit',
    "defaultQuantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "percentage" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "costingCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dealSheet" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "marketRegion" TEXT NOT NULL DEFAULT 'Jamaica',
    "companyId" TEXT,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "contingencyPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "targetMarginPct" DECIMAL(6,2) NOT NULL DEFAULT 35,
    "directCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "contingencyAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "targetPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "finalTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "researchSummary" TEXT,
    "researchSources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dealSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dealSheetLine" (
    "id" TEXT NOT NULL,
    "dealSheetId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'engagement',
    "baseCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "criteriaCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "directCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "suggestedPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marketLow" DECIMAL(14,2),
    "marketMedian" DECIMAL(14,2),
    "marketHigh" DECIMAL(14,2),
    "criteriaSnapshot" JSONB,
    "researchRationale" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dealSheetLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dealSheet_reference_key" ON "dealSheet"("reference");
CREATE INDEX "costingCriterion_catalogCostProfileId_active_position_idx" ON "costingCriterion"("catalogCostProfileId", "active", "position");
CREATE INDEX "dealSheet_status_updatedAt_idx" ON "dealSheet"("status", "updatedAt");
CREATE INDEX "dealSheet_companyId_idx" ON "dealSheet"("companyId");
CREATE INDEX "dealSheet_projectId_idx" ON "dealSheet"("projectId");
CREATE INDEX "dealSheet_createdById_idx" ON "dealSheet"("createdById");
CREATE INDEX "dealSheetLine_dealSheetId_position_idx" ON "dealSheetLine"("dealSheetId", "position");
CREATE INDEX "dealSheetLine_catalogItemId_idx" ON "dealSheetLine"("catalogItemId");

ALTER TABLE "costingCriterion" ADD CONSTRAINT "costingCriterion_catalogCostProfileId_fkey" FOREIGN KEY ("catalogCostProfileId") REFERENCES "catalogCostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dealSheet" ADD CONSTRAINT "dealSheet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dealSheet" ADD CONSTRAINT "dealSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dealSheet" ADD CONSTRAINT "dealSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dealSheetLine" ADD CONSTRAINT "dealSheetLine_dealSheetId_fkey" FOREIGN KEY ("dealSheetId") REFERENCES "dealSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dealSheetLine" ADD CONSTRAINT "dealSheetLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "invoiceAssistantSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'CLIENT_WORK',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "companyId" TEXT,
    "createdById" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "draft" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoiceAssistantSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoiceAssistantAttachment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoiceAssistantAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoiceAssistantAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoiceAssistantAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoiceAssistantSession_createdById_updatedAt_idx" ON "invoiceAssistantSession"("createdById", "updatedAt");
CREATE INDEX "invoiceAssistantSession_companyId_updatedAt_idx" ON "invoiceAssistantSession"("companyId", "updatedAt");
CREATE INDEX "invoiceAssistantAttachment_sessionId_createdAt_idx" ON "invoiceAssistantAttachment"("sessionId", "createdAt");
CREATE INDEX "invoiceAssistantAction_sessionId_status_createdAt_idx" ON "invoiceAssistantAction"("sessionId", "status", "createdAt");
ALTER TABLE "invoiceAssistantSession" ADD CONSTRAINT "invoiceAssistantSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoiceAssistantSession" ADD CONSTRAINT "invoiceAssistantSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoiceAssistantAttachment" ADD CONSTRAINT "invoiceAssistantAttachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "invoiceAssistantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoiceAssistantAction" ADD CONSTRAINT "invoiceAssistantAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "invoiceAssistantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoiceAssistantAction" ADD CONSTRAINT "invoiceAssistantAction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
