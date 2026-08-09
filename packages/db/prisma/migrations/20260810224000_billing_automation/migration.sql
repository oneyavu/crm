CREATE TYPE "BillingScheduleKind" AS ENUM ('RECURRING_INVOICE', 'SUBSCRIPTION');
CREATE TYPE "BillingCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

ALTER TABLE "invoice"
ADD COLUMN "dueTime" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN "scheduleId" TEXT;

CREATE TABLE "invoiceSchedule" (
  "id" TEXT NOT NULL,
  "kind" "BillingScheduleKind" NOT NULL DEFAULT 'RECURRING_INVOICE',
  "cadence" "BillingCadence" NOT NULL DEFAULT 'MONTHLY',
  "interval" INTEGER NOT NULL DEFAULT 1,
  "templateInvoiceId" TEXT NOT NULL,
  "nextIssueAt" TIMESTAMP(3) NOT NULL,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 7,
  "dueTime" TEXT NOT NULL DEFAULT '17:00',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sendAutomatically" BOOLEAN NOT NULL DEFAULT false,
  "remindAdmin" BOOLEAN NOT NULL DEFAULT true,
  "remindClient" BOOLEAN NOT NULL DEFAULT true,
  "reminderDays" INTEGER[] DEFAULT ARRAY[7, 3, 1, 0]::INTEGER[],
  "lastGeneratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoiceSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoiceSchedule_templateInvoiceId_key" ON "invoiceSchedule"("templateInvoiceId");
CREATE INDEX "invoiceSchedule_active_nextIssueAt_idx" ON "invoiceSchedule"("active", "nextIssueAt");
CREATE INDEX "invoice_scheduleId_idx" ON "invoice"("scheduleId");

ALTER TABLE "invoiceSchedule" ADD CONSTRAINT "invoiceSchedule_templateInvoiceId_fkey" FOREIGN KEY ("templateInvoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "invoiceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoiceSchedule" ADD CONSTRAINT "invoiceSchedule_interval_check" CHECK ("interval" >= 1);
ALTER TABLE "invoiceSchedule" ADD CONSTRAINT "invoiceSchedule_paymentTermsDays_check" CHECK ("paymentTermsDays" >= 0);
