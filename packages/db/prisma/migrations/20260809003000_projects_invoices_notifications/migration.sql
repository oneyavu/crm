CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

CREATE TYPE "ProjectTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

CREATE TYPE "ProjectTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

CREATE TYPE "NotificationType" AS ENUM ('PROJECT_ASSIGNED', 'PROJECT_UPDATED', 'TASK_ASSIGNED', 'TASK_UPDATED', 'INVOICE_SENT', 'INVOICE_DUE', 'INVOICE_PAID');

CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');

CREATE TYPE "CatalogItemKind" AS ENUM ('DIGITAL_TOOL', 'PLATFORM_CAPABILITY', 'SERVICE', 'USE_CASE', 'AUTOMATION_PLAN');

CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "companyId" TEXT,
    "ownerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "budget" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectMember_pkey" PRIMARY KEY ("projectId","userId")
);

CREATE TABLE "catalogItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CatalogItemKind" NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "operatingProblem" TEXT,
    "solution" TEXT,
    "outcomes" TEXT[],
    "capabilities" TEXT[],
    "measures" TEXT[],
    "investmentPath" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projectCatalogItem" (
    "projectId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectCatalogItem_pkey" PRIMARY KEY ("projectId","catalogItemId")
);

CREATE TABLE "projectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "ProjectTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "position" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projectTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "position" INTEGER NOT NULL,
    "catalogItemId" TEXT,

    CONSTRAINT "invoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoiceSequence" (
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "invoiceSequence_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "invoiceId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "emailDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "invoiceId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerId" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_number_key" ON "invoice"("number");
CREATE UNIQUE INDEX "catalogItem_code_key" ON "catalogItem"("code");
CREATE UNIQUE INDEX "emailDelivery_notificationId_key" ON "emailDelivery"("notificationId");
CREATE INDEX "project_companyId_idx" ON "project"("companyId");
CREATE INDEX "project_ownerId_idx" ON "project"("ownerId");
CREATE INDEX "project_status_idx" ON "project"("status");
CREATE INDEX "project_dueDate_idx" ON "project"("dueDate");
CREATE INDEX "projectMember_userId_idx" ON "projectMember"("userId");
CREATE INDEX "catalogItem_kind_position_idx" ON "catalogItem"("kind", "position");
CREATE INDEX "catalogItem_category_idx" ON "catalogItem"("category");
CREATE INDEX "projectCatalogItem_catalogItemId_idx" ON "projectCatalogItem"("catalogItemId");
CREATE INDEX "projectTask_projectId_status_position_idx" ON "projectTask"("projectId", "status", "position");
CREATE INDEX "projectTask_assigneeId_status_idx" ON "projectTask"("assigneeId", "status");
CREATE INDEX "projectTask_dueDate_idx" ON "projectTask"("dueDate");
CREATE INDEX "invoice_companyId_idx" ON "invoice"("companyId");
CREATE INDEX "invoice_projectId_idx" ON "invoice"("projectId");
CREATE INDEX "invoice_status_idx" ON "invoice"("status");
CREATE INDEX "invoice_dueDate_idx" ON "invoice"("dueDate");
CREATE INDEX "invoiceLine_invoiceId_position_idx" ON "invoiceLine"("invoiceId", "position");
CREATE INDEX "invoiceLine_catalogItemId_idx" ON "invoiceLine"("catalogItemId");
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt");
CREATE INDEX "notification_projectId_idx" ON "notification"("projectId");
CREATE INDEX "notification_taskId_idx" ON "notification"("taskId");
CREATE INDEX "notification_invoiceId_idx" ON "notification"("invoiceId");
CREATE INDEX "emailDelivery_status_nextAttemptAt_idx" ON "emailDelivery"("status", "nextAttemptAt");
CREATE INDEX "emailDelivery_invoiceId_idx" ON "emailDelivery"("invoiceId");

ALTER TABLE "project" ADD CONSTRAINT "project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project" ADD CONSTRAINT "project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projectMember" ADD CONSTRAINT "projectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectMember" ADD CONSTRAINT "projectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectCatalogItem" ADD CONSTRAINT "projectCatalogItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectCatalogItem" ADD CONSTRAINT "projectCatalogItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projectTask" ADD CONSTRAINT "projectTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoiceLine" ADD CONSTRAINT "invoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoiceLine" ADD CONSTRAINT "invoiceLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "projectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emailDelivery" ADD CONSTRAINT "emailDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emailDelivery" ADD CONSTRAINT "emailDelivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "catalogItem" ("id", "code", "name", "kind", "category", "summary", "operatingProblem", "solution", "outcomes", "capabilities", "measures", "investmentPath", "sourceUrl", "position", "updatedAt") VALUES
('vayu_dt_01', 'DT-01', 'OneCard', 'DIGITAL_TOOL', 'Identity', 'NFC and QR sharing with a branded contact profile, lead capture, engagement context and a path into follow-up.', NULL, NULL, ARRAY['Paperless contact sharing', 'Measurable relationship capture'], ARRAY['NFC and QR sharing', 'Lead capture', 'Engagement history'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/digital-tools/', 1, CURRENT_TIMESTAMP),
('vayu_dt_02', 'DT-02', 'OneDigital', 'DIGITAL_TOOL', 'Engagement', 'Turns QR, NFC and campaign touchpoints into guided journeys, structured responses, routing rules and management reporting.', NULL, NULL, ARRAY['Connected physical and digital campaigns', 'Measurable customer action'], ARRAY['Campaign journeys', 'Response routing', 'Interaction reporting'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/digital-tools/', 2, CURRENT_TIMESTAMP),
('vayu_dt_03', 'DT-03', 'SuprCreate', 'DIGITAL_TOOL', 'Creation', 'A governed workspace to plan assets, prepare campaigns, coordinate approvals and connect published content to commercial actions.', NULL, NULL, ARRAY['Faster campaign activation', 'Governed content delivery'], ARRAY['Campaign activation', 'Content workflow', 'Commercial tracking'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/digital-tools/', 3, CURRENT_TIMESTAMP),
('vayu_dt_04', 'DT-04', 'WhatsApp Agents', 'DIGITAL_TOOL', 'Conversation', 'Approved conversational agents that qualify requests, collect details, trigger workflows and hand complex conversations to people.', NULL, NULL, ARRAY['Rapid response', 'Structured customer intake'], ARRAY['Rapid response', 'Lead qualification', 'Human escalation'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/digital-tools/', 4, CURRENT_TIMESTAMP),
('vayu_dt_05', 'DT-05', 'Custom CRM', 'DIGITAL_TOOL', 'Operations', 'A tailored relationship and workflow system that unites leads, clients, tasks, communications, documents and reporting.', NULL, NULL, ARRAY['Accountability', 'One customer record'], ARRAY['Pipeline control', 'Client records', 'Team reporting'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/digital-tools/', 5, CURRENT_TIMESTAMP),
('vayu_dt_06', 'DT-06', 'Custom Websites', 'DIGITAL_TOOL', 'Web', 'Responsive public experiences connected to structured forms, routing, follow-up, analytics and internal ownership.', NULL, NULL, ARRAY['Measurable lead capture', 'Connected follow-up'], ARRAY['Conversion design', 'Structured intake', 'Workflow connection'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/digital-tools/', 6, CURRENT_TIMESTAMP),
('vayu_plt_01', 'PLT-01', 'Enterprise Operating Platforms', 'PLATFORM_CAPABILITY', 'Platform', 'Connect systems of record, approvals, teams, queues and reporting inside one governed operating layer.', NULL, NULL, ARRAY['One source of operational truth', 'Controlled workflows and approvals'], ARRAY['Workflow engine', 'Data layer', 'Role controls', 'Executive intelligence'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/platform/', 7, CURRENT_TIMESTAMP),
('vayu_cxm_02', 'CXM-02', 'Customer Operations', 'PLATFORM_CAPABILITY', 'Customer Operations', 'Coordinate voice, chat, digital intake, service tickets, SLA monitoring and human escalation.', NULL, NULL, ARRAY['Faster service', 'Visible SLA risk'], ARRAY['Voice and chat', 'Intake and routing', 'SLA monitoring', 'Human escalation'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/platform/', 8, CURRENT_TIMESTAMP),
('vayu_rev_03', 'REV-03', 'Revenue Intelligence', 'PLATFORM_CAPABILITY', 'Revenue', 'Capture demand, qualify opportunities, assign ownership, manage follow-up and expose pipeline movement.', NULL, NULL, ARRAY['Pipeline visibility', 'Consistent follow-up'], ARRAY['Lead capture', 'Qualification', 'Ownership', 'Commercial reporting'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/platform/', 9, CURRENT_TIMESTAMP),
('vayu_fld_04', 'FLD-04', 'Field and Dispatch Operations', 'PLATFORM_CAPABILITY', 'Field Operations', 'Route work by skill, branch, priority and location while monitoring acceptance, exceptions and completion.', NULL, NULL, ARRAY['Faster dispatch', 'Proof of completion'], ARRAY['Assignment', 'Dispatch', 'Route status', 'Exception handling'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/platform/', 10, CURRENT_TIMESTAMP),
('vayu_wrk_05', 'WRK-05', 'Workflow Infrastructure', 'PLATFORM_CAPABILITY', 'Workflow', 'Control documents, approvals, notifications, case states and operational events without fragmented handoffs.', NULL, NULL, ARRAY['Shorter cycle times', 'Governed automation'], ARRAY['Case management', 'Document processing', 'Approvals', 'Notifications'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/platform/', 11, CURRENT_TIMESTAMP),
('vayu_inf_06', 'INF-06', 'AI Infrastructure', 'PLATFORM_CAPABILITY', 'Infrastructure', 'Private, hybrid or managed AI environments with integrations, observability, access governance and support.', NULL, NULL, ARRAY['Controlled AI access', 'Production reliability'], ARRAY['Private and hybrid AI', 'Integration layers', 'Observability', 'Production controls'], ARRAY[]::TEXT[], 'Enterprise programme', 'https://onevayu.com/platform/', 12, CURRENT_TIMESTAMP),
('vayu_svc_01', 'SVC-01', 'Strategy and Architecture', 'SERVICE', 'Delivery', 'Define the operating objective, systems, controls and scale path before build.', NULL, NULL, ARRAY['Approved solution scope', 'Clear governance model'], ARRAY['Discovery', 'Requirements', 'Solution architecture'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/', 13, CURRENT_TIMESTAMP),
('vayu_svc_02', 'SVC-02', 'Product Engineering', 'SERVICE', 'Delivery', 'Design and build the platform, interfaces, intelligence and workflow logic.', NULL, NULL, ARRAY['Production-ready product', 'Controlled releases'], ARRAY['Product design', 'Software engineering', 'Quality assurance'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/', 14, CURRENT_TIMESTAMP),
('vayu_svc_03', 'SVC-03', 'Deployment and Integration', 'SERVICE', 'Delivery', 'Connect approved systems, test edge cases and move into production in controlled stages.', NULL, NULL, ARRAY['Connected systems', 'Safe production launch'], ARRAY['System integration', 'Data migration', 'Deployment'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/', 15, CURRENT_TIMESTAMP),
('vayu_svc_04', 'SVC-04', 'Managed Performance', 'SERVICE', 'Delivery', 'Monitor service levels, adoption and exceptions while identifying opportunities for the next release.', NULL, NULL, ARRAY['Continuous improvement', 'Operational visibility'], ARRAY['Monitoring', 'Governance', 'Production support'], ARRAY[]::TEXT[], NULL, 'https://onevayu.com/', 16, CURRENT_TIMESTAMP),
('vayu_uc_01', 'UC-01', 'Lead Qualification and Sales Follow-up', 'USE_CASE', 'Revenue', 'A governed intake, qualification, ownership and follow-up workflow connected to pipeline reporting.', 'Inbound demand is captured inconsistently and follow-up depends on manual reminders.', 'Governed intake, qualification, ownership and follow-up connected to pipeline reporting.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Lead response', 'Conversion', 'Pipeline movement'], 'Launch or Growth', 'https://onevayu.com/use-cases/', 17, CURRENT_TIMESTAMP),
('vayu_uc_02', 'UC-02', 'AI Contact Centre Triage', 'USE_CASE', 'Customer Operations', 'Intent capture, ticket creation, smart routing, SLA monitoring and human escalation across approved channels.', 'Calls and digital requests reach the wrong team, wait too long or disappear between channels.', 'Intent capture, ticket creation, smart routing, SLA monitoring and human escalation.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Response time', 'First-contact resolution', 'SLA risk'], 'Growth or Managed', 'https://onevayu.com/use-cases/', 18, CURRENT_TIMESTAMP),
('vayu_uc_03', 'UC-03', 'Field Service Dispatch Console', 'USE_CASE', 'Field Operations', 'Structured intake, assignment logic, technician briefs, route status, exceptions and closeout evidence.', 'Work orders are assigned without consistent skill, location, priority or completion controls.', 'Structured intake, assignment logic, technician briefs, route status and closeout evidence.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Dispatch time', 'Completion rate', 'Repeat visits'], 'Growth', 'https://onevayu.com/use-cases/', 19, CURRENT_TIMESTAMP),
('vayu_uc_04', 'UC-04', 'Revenue Recovery Workflow', 'USE_CASE', 'Revenue', 'Segmented outreach, approved messages, payment links, promises-to-pay and escalation reporting.', 'Renewals, invoices, payment commitments and abandoned quotes do not receive timely follow-up.', 'Segmented outreach, approved messages, response links and escalation reporting.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Recovery value', 'Response rate', 'Unresolved accounts'], 'Launch or Growth', 'https://onevayu.com/use-cases/', 20, CURRENT_TIMESTAMP),
('vayu_uc_05', 'UC-05', 'Document Intake and Approval Queue', 'USE_CASE', 'Workflow', 'Secure uploads, completeness checks, requests, approval routing, status updates and audit history.', 'Teams repeatedly request missing documents and cannot see where cases are delayed.', 'Secure uploads, completeness checks, approval routing, status updates and audit history.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Cycle time', 'Incomplete submissions', 'Approval backlog'], 'Launch or Growth', 'https://onevayu.com/use-cases/', 21, CURRENT_TIMESTAMP),
('vayu_uc_06', 'UC-06', 'Self-service Client Operations Portal', 'USE_CASE', 'Customer Operations', 'Authenticated intake, document exchange, request status and workflow triggers connected to internal teams.', 'Customers depend on calls and email to submit requests, upload documents and check progress.', 'Authenticated intake, document exchange, request status and internal workflow triggers.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Call deflection', 'Completion rate', 'Customer effort'], 'Growth', 'https://onevayu.com/use-cases/', 22, CURRENT_TIMESTAMP),
('vayu_uc_07', 'UC-07', 'Executive Operations Dashboard', 'USE_CASE', 'Workflow', 'A role-based command view of events, KPIs, exceptions and recommended management actions.', 'Leadership receives delayed reports and cannot see queue volume, revenue leakage or service risk.', 'A role-based command view of operational events, KPIs, exceptions and management actions.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Reporting time', 'Exception age', 'SLA coverage'], 'Growth or Managed', 'https://onevayu.com/use-cases/', 23, CURRENT_TIMESTAMP),
('vayu_uc_08', 'UC-08', 'Private AI Deployment Environment', 'USE_CASE', 'Infrastructure', 'Private or hybrid AI infrastructure with access controls, integrations, logging and operational support.', 'Sensitive workflows require controlled AI access, approved data boundaries and observability.', 'Private or hybrid AI infrastructure with governance and operational support.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Availability', 'Latency', 'Controlled access', 'Incident rate'], 'Enterprise programme', 'https://onevayu.com/use-cases/', 24, CURRENT_TIMESTAMP),
('vayu_uc_09', 'UC-09', 'Branch and Event Operations Routing', 'USE_CASE', 'Field Operations', 'Branch-aware intake, capacity rules, payment events, dispatch and management dashboards.', 'Orders, service requests or event activity must be assigned to the correct location and team.', 'Branch-aware intake, capacity rules, confirmation events, dispatch and dashboards.', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['Routing accuracy', 'Acceptance time', 'Completion status'], 'Growth', 'https://onevayu.com/use-cases/', 25, CURRENT_TIMESTAMP),
('vayu_plan_01', 'PLAN-01', 'Launch Automation Plan', 'AUTOMATION_PLAN', 'Managed Automation', 'A focused starting plan for proving one high-value workflow and establishing the operating baseline.', NULL, NULL, ARRAY['Fast initial deployment', 'Evidence for expansion'], ARRAY['Focused workflow', 'Standard integrations', 'Email support'], ARRAY[]::TEXT[], 'Launch', 'https://onevayu.com/automation-plans/', 26, CURRENT_TIMESTAMP),
('vayu_plan_02', 'PLAN-02', 'Growth Automation Plan', 'AUTOMATION_PLAN', 'Managed Automation', 'An expanded automation plan for high-impact organizations coordinating multiple workflows and integrations.', NULL, NULL, ARRAY['Expanded capacity', 'Priority operating support'], ARRAY['Extended integration library', 'New process mapping', 'Priority support'], ARRAY[]::TEXT[], 'Growth', 'https://onevayu.com/automation-plans/', 27, CURRENT_TIMESTAMP),
('vayu_plan_03', 'PLAN-03', 'Managed Enterprise Programme', 'AUTOMATION_PLAN', 'Managed Automation', 'Enterprise-grade automation, account management, training, continuous deployment and dedicated support.', NULL, NULL, ARRAY['Enterprise scale', 'Continuous operational improvement'], ARRAY['Automation suite', 'Staff training', 'Continuous deployment', 'AI Foundry', '24/7 support'], ARRAY[]::TEXT[], 'Enterprise programme', 'https://onevayu.com/automation-plans/', 28, CURRENT_TIMESTAMP);
