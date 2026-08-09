CREATE TYPE "ServiceRequestCategory" AS ENUM ('SUPPORT', 'CHANGE_REQUEST', 'BILLING', 'ACCESS', 'INTEGRATION', 'OTHER');
CREATE TYPE "ServiceRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED');
CREATE TYPE "ServiceRequestMessageSource" AS ENUM ('CLIENT', 'STAFF', 'AI', 'SYSTEM');
CREATE TYPE "SupportWidgetPosition" AS ENUM ('BOTTOM_LEFT', 'BOTTOM_RIGHT');
CREATE TYPE "SupportConversationSource" AS ENUM ('PORTAL', 'WIDGET');
CREATE TYPE "SupportConversationStatus" AS ENUM ('AI_ACTIVE', 'WAITING_FOR_AGENT', 'LIVE_AGENT', 'CLOSED');
CREATE TYPE "SupportMessageRole" AS ENUM ('VISITOR', 'ASSISTANT', 'AGENT', 'SYSTEM');

CREATE TABLE "serviceRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceRequestCategory" NOT NULL DEFAULT 'SUPPORT',
    "priority" "ServiceRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "requestedByAccessId" TEXT NOT NULL,
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "serviceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "serviceRequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "source" "ServiceRequestMessageSource" NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" TEXT,
    "authorAccessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "serviceRequestMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supportWidget" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'VAYU Concierge',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Hi! How can we help today?',
    "accentColor" TEXT NOT NULL DEFAULT '#7bff5a',
    "position" "SupportWidgetPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "liveSupportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requireEmail" BOOLEAN NOT NULL DEFAULT true,
    "allowedDomains" TEXT[] NOT NULL,
    "quickActions" JSONB,
    "knowledgeText" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supportWidget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supportConversation" (
    "id" TEXT NOT NULL,
    "source" "SupportConversationSource" NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'AI_ACTIVE',
    "sessionToken" TEXT NOT NULL,
    "visitorName" TEXT,
    "visitorEmail" TEXT,
    "subject" TEXT,
    "widgetId" TEXT,
    "companyId" TEXT,
    "assignedToUserId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supportConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "SupportMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supportMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "serviceRequest_reference_key" ON "serviceRequest"("reference");
CREATE INDEX "serviceRequest_companyId_status_updatedAt_idx" ON "serviceRequest"("companyId", "status", "updatedAt");
CREATE INDEX "serviceRequest_projectId_updatedAt_idx" ON "serviceRequest"("projectId", "updatedAt");
CREATE INDEX "serviceRequestMessage_requestId_createdAt_idx" ON "serviceRequestMessage"("requestId", "createdAt");
CREATE UNIQUE INDEX "supportWidget_publicKey_key" ON "supportWidget"("publicKey");
CREATE UNIQUE INDEX "supportConversation_sessionToken_key" ON "supportConversation"("sessionToken");
CREATE INDEX "supportConversation_status_lastMessageAt_idx" ON "supportConversation"("status", "lastMessageAt");
CREATE INDEX "supportConversation_companyId_lastMessageAt_idx" ON "supportConversation"("companyId", "lastMessageAt");
CREATE INDEX "supportConversation_widgetId_lastMessageAt_idx" ON "supportConversation"("widgetId", "lastMessageAt");
CREATE INDEX "supportMessage_conversationId_createdAt_idx" ON "supportMessage"("conversationId", "createdAt");

ALTER TABLE "serviceRequest" ADD CONSTRAINT "serviceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "serviceRequest" ADD CONSTRAINT "serviceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "serviceRequest" ADD CONSTRAINT "serviceRequest_requestedByAccessId_fkey" FOREIGN KEY ("requestedByAccessId") REFERENCES "clientPortalAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "serviceRequestMessage" ADD CONSTRAINT "serviceRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "serviceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "serviceRequestMessage" ADD CONSTRAINT "serviceRequestMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "serviceRequestMessage" ADD CONSTRAINT "serviceRequestMessage_authorAccessId_fkey" FOREIGN KEY ("authorAccessId") REFERENCES "clientPortalAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supportConversation" ADD CONSTRAINT "supportConversation_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "supportWidget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supportConversation" ADD CONSTRAINT "supportConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supportConversation" ADD CONSTRAINT "supportConversation_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supportMessage" ADD CONSTRAINT "supportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "supportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supportMessage" ADD CONSTRAINT "supportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "TransferMethod" AS ENUM ('CHECK', 'RTGS', 'ACH', 'DIRECT_TRANSFER');
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

CREATE TABLE "paymentBankAccount" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAddress" TEXT,
    "branchName" TEXT,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT,
    "swiftCode" TEXT,
    "branchCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paymentBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoicePaymentSubmission" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submittedByAccessId" TEXT NOT NULL,
    "method" "TransferMethod" NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCents" INTEGER,
    "transactionId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "senderBank" TEXT,
    "senderBranch" TEXT,
    "attachmentName" TEXT,
    "attachmentType" TEXT,
    "attachmentSize" INTEGER,
    "attachment" BYTEA,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoicePaymentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "paymentBankAccount_currency_key" ON "paymentBankAccount"("currency");
CREATE INDEX "invoicePaymentSubmission_invoiceId_createdAt_idx" ON "invoicePaymentSubmission"("invoiceId", "createdAt");
CREATE INDEX "invoicePaymentSubmission_companyId_status_createdAt_idx" ON "invoicePaymentSubmission"("companyId", "status", "createdAt");
ALTER TABLE "invoicePaymentSubmission" ADD CONSTRAINT "invoicePaymentSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoicePaymentSubmission" ADD CONSTRAINT "invoicePaymentSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoicePaymentSubmission" ADD CONSTRAINT "invoicePaymentSubmission_submittedByAccessId_fkey" FOREIGN KEY ("submittedByAccessId") REFERENCES "clientPortalAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoicePaymentSubmission" ADD CONSTRAINT "invoicePaymentSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "paymentBankAccount" (
    "id", "currency", "label", "bankName", "bankAddress", "branchName",
    "accountName", "accountNumber", "accountType", "swiftCode", "branchCode"
) VALUES (
    'vayu-usd-business-savings', 'USD', 'USD Business Savings', 'Scotiabank Jamaica',
    'Junction Branch', 'Junction Branch', 'VAYU LIMITED', '000424765',
    'Business Savings', 'NOSCJMKNXXX', '22475'
);

-- This release intentionally moves every existing chat and automation version
-- off AI Gateway routing and onto the direct OpenAI GPT-5.5 provider.
UPDATE "appSetting"
SET "agentModelId" = 'openai/gpt-5.5',
    "agentModelContextWindow" = 1050000;

UPDATE "agentVersion"
SET "modelId" = 'openai/gpt-5.5',
    "modelContextWindowTokens" = 1050000;
