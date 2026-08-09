CREATE TABLE "paperclipOutbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdById" TEXT NOT NULL,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "paperclipOutbox_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "paperclipSnapshot" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paperclipSnapshot_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "paperclipOutbox_status_nextAttemptAt_idx" ON "paperclipOutbox"("status", "nextAttemptAt");
CREATE INDEX "paperclipOutbox_createdAt_idx" ON "paperclipOutbox"("createdAt");
