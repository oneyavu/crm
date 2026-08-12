ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INQUIRY_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PLATFORM_ALERT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_BRIEF';

CREATE TYPE "InquirySource" AS ENUM ('WEBSITE', 'SUPRCREATE', 'ONECARD', 'ONEDIGITAL', 'CHAT', 'EMAIL', 'MANUAL');
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'TRIAGED', 'QUALIFIED', 'CONVERTED', 'CLOSED', 'SPAM');
CREATE TYPE "PlatformKind" AS ENUM ('WEBSITE', 'SUPRCREATE', 'ONECARD', 'ONEDIGITAL');
CREATE TYPE "PlatformHealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'DOWN', 'AUTH_REQUIRED');
CREATE TYPE "PlatformActionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'QUEUED', 'COMPLETED', 'FAILED', 'REJECTED');

CREATE TABLE "inquiry" (
    "id" TEXT NOT NULL, "reference" TEXT NOT NULL, "source" "InquirySource" NOT NULL, "externalId" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW', "organizationName" TEXT, "contactName" TEXT,
    "email" TEXT, "phone" TEXT, "website" TEXT, "country" TEXT, "industry" TEXT, "organizationSize" TEXT,
    "challenge" TEXT, "desiredOutcome" TEXT, "currentSystems" TEXT, "monthlyVolume" TEXT, "timeline" TEXT,
    "investment" TEXT, "deliveryModel" TEXT, "sensitivity" TEXT, "hosting" TEXT, "followUp" TEXT,
    "security" TEXT, "notes" TEXT, "consent" BOOLEAN NOT NULL DEFAULT false, "campaign" JSONB,
    "rawPayload" JSONB NOT NULL, "companyId" TEXT, "contactId" TEXT, "dealId" TEXT, "assignedToId" TEXT,
    "priority" TEXT, "score" INTEGER, "triageSummary" TEXT, "triagedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platformConnection" (
    "id" TEXT NOT NULL, "kind" "PlatformKind" NOT NULL, "name" TEXT NOT NULL, "baseUrl" TEXT NOT NULL,
    "adminUrl" TEXT NOT NULL, "embedUrl" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true,
    "embedAllowed" BOOLEAN NOT NULL DEFAULT false, "writeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "readOnlyVerifiedAt" TIMESTAMP(3), "healthStatus" "PlatformHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3), "lastHealthyAt" TIMESTAMP(3), "lastError" TEXT, "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platformConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platformEvent" (
    "id" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "externalId" TEXT, "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO', "title" TEXT NOT NULL, "summary" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL, "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "platformEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platformAction" (
    "id" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "kind" TEXT NOT NULL, "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL, "status" "PlatformActionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "requestedById" TEXT NOT NULL, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platformAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inquiry_reference_key" ON "inquiry"("reference");
CREATE UNIQUE INDEX "inquiry_source_externalId_key" ON "inquiry"("source", "externalId");
CREATE INDEX "inquiry_status_createdAt_idx" ON "inquiry"("status", "createdAt");
CREATE INDEX "inquiry_source_createdAt_idx" ON "inquiry"("source", "createdAt");
CREATE INDEX "inquiry_companyId_idx" ON "inquiry"("companyId");
CREATE INDEX "inquiry_contactId_idx" ON "inquiry"("contactId");
CREATE INDEX "inquiry_assignedToId_status_idx" ON "inquiry"("assignedToId", "status");
CREATE UNIQUE INDEX "platformConnection_kind_key" ON "platformConnection"("kind");
CREATE UNIQUE INDEX "platformEvent_connectionId_externalId_key" ON "platformEvent"("connectionId", "externalId");
CREATE INDEX "platformEvent_connectionId_occurredAt_idx" ON "platformEvent"("connectionId", "occurredAt");
CREATE INDEX "platformEvent_severity_occurredAt_idx" ON "platformEvent"("severity", "occurredAt");
CREATE INDEX "platformAction_connectionId_status_createdAt_idx" ON "platformAction"("connectionId", "status", "createdAt");
CREATE INDEX "platformAction_requestedById_createdAt_idx" ON "platformAction"("requestedById", "createdAt");

ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platformEvent" ADD CONSTRAINT "platformEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "platformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platformAction" ADD CONSTRAINT "platformAction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "platformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platformAction" ADD CONSTRAINT "platformAction_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platformAction" ADD CONSTRAINT "platformAction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
