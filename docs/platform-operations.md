# Platform Operations

Platform Operations is an administrator-only V-OS workspace for inquiry intake,
product administration, connector health, Paperclip briefs and approval-gated
external actions.

## Production configuration

Generate separate random values for these variables:

```text
WEBSITE_INTAKE_WEBHOOK_SECRET
PLATFORM_CONNECTOR_WEBHOOK_SECRET
PAPERCLIP_OPERATIONS_AGENT_ID
```

The CRM receives website inquiries at:

```text
POST /webhooks/vayu/inquiries/website
```

Install `integrations/wordpress/v-os-inquiry-bridge.php` as a WordPress must-use
plugin and add these constants to `wp-config.php`:

```php
define('VOS_INTAKE_ENDPOINT', 'https://api.asina.onevayu.com/webhooks/vayu/inquiries/website');
define('VOS_INTAKE_SECRET', getenv('WEBSITE_INTAKE_WEBHOOK_SECRET'));
```

The bridge observes successful requests to `/wp-json/vayu/v1/inquiries`, forwards
the normalized payload without delaying the visitor response, and provides a stable
external identifier so retries cannot create duplicate inquiries.

## Connector events

SuprCreate, OneDigital Card and One Digital can push read-only updates to:

```text
POST /webhooks/vayu/platforms/SUPRCREATE/events
POST /webhooks/vayu/platforms/ONECARD/events
POST /webhooks/vayu/platforms/ONEDIGITAL/events
```

The event body is:

```json
{
  "externalId": "provider-event-id",
  "type": "campaign.updated",
  "severity": "INFO",
  "title": "Campaign updated",
  "summary": "Optional human-readable detail",
  "occurredAt": "2026-08-12T15:00:00.000Z",
  "payload": {}
}
```

Every public webhook request requires:

```text
X-VAYU-Timestamp: Unix timestamp in seconds
X-VAYU-Signature: sha256=<HMAC-SHA256(timestamp + "." + canonical JSON body)>
```

Requests older than five minutes are rejected. External identifiers make connector
events idempotent.

## Write safety

External writes begin disabled. An administrator must first run a successful health
check, mark the connector read-only verified, explicitly enable approved writes,
create an action request and approve it. Approval queues the instruction to the
configured Paperclip operations agent. The platform must return an
`action.completed` event with the action ID as `externalId` to close the audit loop.
