-- Native V-OS project workspace: phases, task planning, discussions and dependencies.
ALTER TABLE "projectTask"
ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "phaseId" TEXT,
ADD COLUMN "parentTaskId" TEXT;

ALTER TABLE "timeEntry"
ADD CONSTRAINT "timeEntry_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "projectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "projectPhase" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6cd32c',
  "position" INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projectPhase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projectTaskDependency" (
  "taskId" TEXT NOT NULL,
  "blockedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projectTaskDependency_pkey" PRIMARY KEY ("taskId", "blockedById")
);

CREATE TABLE "projectTaskComment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projectTaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projectTask_phaseId_position_idx" ON "projectTask"("phaseId", "position");
CREATE INDEX "projectTask_parentTaskId_idx" ON "projectTask"("parentTaskId");
CREATE INDEX "projectPhase_projectId_position_idx" ON "projectPhase"("projectId", "position");
CREATE INDEX "projectTaskDependency_blockedById_idx" ON "projectTaskDependency"("blockedById");
CREATE INDEX "projectTaskComment_taskId_createdAt_idx" ON "projectTaskComment"("taskId", "createdAt");
CREATE INDEX "projectTaskComment_authorId_createdAt_idx" ON "projectTaskComment"("authorId", "createdAt");
CREATE INDEX "timeEntry_taskId_startedAt_idx" ON "timeEntry"("taskId", "startedAt");

ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "projectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "projectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projectPhase" ADD CONSTRAINT "projectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectTaskDependency" ADD CONSTRAINT "projectTaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "projectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectTaskDependency" ADD CONSTRAINT "projectTaskDependency_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "projectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectTaskComment" ADD CONSTRAINT "projectTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "projectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectTaskComment" ADD CONSTRAINT "projectTaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100);
ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_estimatedMinutes_check" CHECK ("estimatedMinutes" >= 0);
ALTER TABLE "projectTaskDependency" ADD CONSTRAINT "projectTaskDependency_not_self_check" CHECK ("taskId" <> "blockedById");
