CREATE TYPE "MeetingVisibility" AS ENUM ('INTERNAL', 'CLIENT');

CREATE TABLE "meetingSummary" (
    "id" TEXT NOT NULL,
    "firefliesTranscriptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "organizerEmail" TEXT,
    "participantEmails" TEXT[],
    "summary" TEXT NOT NULL,
    "actionItems" JSONB,
    "keywords" TEXT[],
    "transcriptUrl" TEXT,
    "visibility" "MeetingVisibility" NOT NULL DEFAULT 'CLIENT',
    "companyId" TEXT,
    "contactId" TEXT,
    "projectId" TEXT,
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meetingSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clientPortalAccess" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clientPortalAccess_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "projectTask" ADD COLUMN "meetingSummaryId" TEXT;

CREATE UNIQUE INDEX "meetingSummary_firefliesTranscriptId_key" ON "meetingSummary"("firefliesTranscriptId");
CREATE UNIQUE INDEX "meetingSummary_calendarEventId_key" ON "meetingSummary"("calendarEventId");
CREATE INDEX "meetingSummary_companyId_meetingAt_idx" ON "meetingSummary"("companyId", "meetingAt");
CREATE INDEX "meetingSummary_projectId_meetingAt_idx" ON "meetingSummary"("projectId", "meetingAt");
CREATE UNIQUE INDEX "clientPortalAccess_email_key" ON "clientPortalAccess"("email");
CREATE INDEX "clientPortalAccess_companyId_active_idx" ON "clientPortalAccess"("companyId", "active");
CREATE INDEX "clientPortalAccess_userId_idx" ON "clientPortalAccess"("userId");
CREATE INDEX "projectTask_meetingSummaryId_idx" ON "projectTask"("meetingSummaryId");

ALTER TABLE "meetingSummary" ADD CONSTRAINT "meetingSummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meetingSummary" ADD CONSTRAINT "meetingSummary_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meetingSummary" ADD CONSTRAINT "meetingSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meetingSummary" ADD CONSTRAINT "meetingSummary_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clientPortalAccess" ADD CONSTRAINT "clientPortalAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clientPortalAccess" ADD CONSTRAINT "clientPortalAccess_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clientPortalAccess" ADD CONSTRAINT "clientPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_meetingSummaryId_fkey" FOREIGN KEY ("meetingSummaryId") REFERENCES "meetingSummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
