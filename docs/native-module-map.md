# VAYU native module map

Perfex is a one-time requirements and migration reference only. Production does not call Perfex, load Perfex source files, share its database, or require the old site to remain online. Every capability below is owned by this repository, its API, and its PostgreSQL schema.

## Delivery domains

| Native domain | Capabilities covered | Current state |
| --- | --- | --- |
| CRM & account planning | Companies, contacts, leads/deals, account plans, goals, notes, activities, reminders, custom fields, tags | Native CRM plus imported source records |
| Projects & work | Projects, milestones, members, tasks, priorities, checklists, followers, comments, timers, files, discussions | Native projects/tasks active; deeper collaboration and time entry next |
| Billing & revenue | Catalog, estimates, proposals, contracts, invoices, payments, credit notes, subscriptions, expenses, taxes, payment modes | Native invoices/catalog active; other records available in Records; dedicated workflows staged |
| Client portal | Scoped client login, projects, tasks, invoices, upcoming meetings, summaries and account updates | Native portal foundation active |
| Meetings & calendar | Google Calendar sync, attendee-to-client matching, meeting links, Fireflies summaries and action-task creation | Calendar sync active; Fireflies webhook ready for credentials |
| Support & field service | Tickets, priorities, replies, service jobs, technicians, parts, images and logs | Imported tickets in Records; dedicated queue staged |
| Finance & accounting | Chart of accounts, journals, banking rules, budgets, reconciliation, transfers and transaction matching | Banking launcher active; native ledger staged; no bank credentials stored |
| People operations | Staff, departments, roles, attendance, leave, shifts, time sheets, payroll, benefits, discipline, contracts, training, recruiting and offboarding | Imported staff in Records; dedicated HR domain staged |
| Assets, inventory & procurement | Assets, locations, units, allocation, inventory history, vendors, requests, approvals, purchase orders, bills and payments | Native domain staged |
| Marketing & communications | Email lists, templates, campaigns, segments, stages, forms, SMS, chat, announcements, newsfeed and scheduled messages | Gmail/calendar ingestion active; campaign domain staged |
| Knowledge & documents | Knowledge base, files, customer shares, templates, e-signature-ready contracts and document history | Records and attachments foundation active; dedicated library staged |
| Governance & automation | Consents, GDPR requests, audit/activity logs, approvals, webhooks, triggers, actions, API tokens and configurable workflows | Native audit/auth foundation active; workflow builder staged |
| Commerce & channels | Products, carts, orders, discounts, WooCommerce channels and sales-channel sync | Catalog active; channel connectors staged |
| Reporting | Executive dashboard, goals, surveys, filters, configurable widgets and operational scorecards | Branded dashboard active; domain scorecards staged |

## Implementation order

1. Shared platform: permissions, client scoping, files, comments, notifications, audit events and workflow triggers.
2. Delivery: project collaboration, checklists, milestones, time tracking and client approvals.
3. Revenue: estimates, proposals, contracts, payments, credits, subscriptions and expenses.
4. Service: ticketing, service jobs, knowledge base and SLAs.
5. Operations: HR, payroll, assets, inventory, procurement and approvals.
6. Growth: marketing automation, forms, campaigns, surveys and commerce channels.
7. Finance: native ledger, bank feeds through supported bank/Open Banking APIs, reconciliation and budgets.

## Integration boundaries

- Google Calendar remains the scheduling source. The CRM stores normalized events and incremental sync tokens, then routes events by attendee email/domain.
- Fireflies sends signed V2 webhook notifications. The CRM verifies HMAC signatures, fetches the completed summary from the official GraphQL API, links it to the client and active project, and creates project tasks from action items.
- Scotiabank Business Online remains on the bank's origin. Its security policy permits framing only by Scotiabank itself, so VAYU launches the official banking page in a separate secure tab and never proxies or captures credentials.
- Imported legacy identifiers are retained only as idempotency metadata. They do not create a runtime dependency on the former CRM.
