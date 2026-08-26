DROP INDEX IF EXISTS "paymentBankAccount_currency_key";

ALTER TABLE "paymentBankAccount"
  ADD COLUMN "routingNumber" TEXT,
  ADD COLUMN "conversion" TEXT,
  ADD COLUMN "destination" TEXT;

CREATE INDEX "paymentBankAccount_currency_active_idx"
  ON "paymentBankAccount"("currency", "active");

ALTER TABLE "invoicePaymentSubmission"
  ADD COLUMN "paymentBankAccountId" TEXT;

CREATE INDEX "invoicePaymentSubmission_paymentBankAccountId_idx"
  ON "invoicePaymentSubmission"("paymentBankAccountId");

ALTER TABLE "invoicePaymentSubmission"
  ADD CONSTRAINT "invoicePaymentSubmission_paymentBankAccountId_fkey"
  FOREIGN KEY ("paymentBankAccountId") REFERENCES "paymentBankAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
