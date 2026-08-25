$ErrorActionPreference = "Stop"

$hermesHome = "C:\Users\oneva\AppData\Local\hermes"
$subscriptionsPath = Join-Path $hermesHome "webhook_subscriptions.json"
$violetHome = Join-Path $hermesHome "profiles\customer-service"
$violetSubscriptionsPath = Join-Path $violetHome "webhook_subscriptions.json"
$bridgeDirectory = "C:\VAYU_LOCAL_OPS\sync"
$bridgeConfigPath = Join-Path $bridgeDirectory "agent-core-bridge.json"
$routeName = "v-os-crm-events"
$violetRouteName = "v-os-website-inquiries"

New-Item -ItemType Directory -Force -Path $bridgeDirectory | Out-Null

$subscriptions = [ordered]@{}
if (Test-Path -LiteralPath $subscriptionsPath) {
	$existing = Get-Content -Raw -LiteralPath $subscriptionsPath | ConvertFrom-Json
	foreach ($property in $existing.PSObject.Properties) {
		$subscriptions[$property.Name] = $property.Value
	}
}

$secret = $subscriptions[$routeName].secret
if (-not $secret) {
	$bytes = [byte[]]::new(32)
	[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
	$secret = [Convert]::ToHexString($bytes).ToLowerInvariant()
}

$subscriptions[$routeName] = [ordered]@{
	description = "Signed V-OS CRM, website onboarding, mailbox, calendar, finance and project events for Asina"
	events = @(
		"crm.snapshot.changed",
		"crm.record.changed",
		"website.inquiry",
		"onboarding.changed",
		"finance.changed",
		"project.changed",
		"mailbox.changed",
		"calendar.changed",
		"duplicate.review.required"
	)
	secret = $secret
	prompt = "Process this event as Asina using the v-os-executive-operations skill. Link it to stable CRM identifiers, preserve client isolation, detect deadlines and duplicate candidates, delegate only the bounded customer-facing portion to Violet, and report actions, approvals, evidence and next due dates. Event: {payload}"
	skills = @("v-os-executive-operations")
	deliver = "log"
	created_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$violetSubscriptions = [ordered]@{}
if (Test-Path -LiteralPath $violetSubscriptionsPath) {
	$existingViolet = Get-Content -Raw -LiteralPath $violetSubscriptionsPath | ConvertFrom-Json
	foreach ($property in $existingViolet.PSObject.Properties) {
		$violetSubscriptions[$property.Name] = $property.Value
	}
}

$violetSecret = $violetSubscriptions[$violetRouteName].secret
if (-not $violetSecret) {
	$violetBytes = [byte[]]::new(32)
	[Security.Cryptography.RandomNumberGenerator]::Fill($violetBytes)
	$violetSecret = [Convert]::ToHexString($violetBytes).ToLowerInvariant()
}

$violetSubscriptions[$violetRouteName] = [ordered]@{
	description = "Verified onevayu.com inquiries for Violet with founder Telegram delivery"
	events = @(
		"website.inquiry",
		"website.inquiry.updated",
		"lead.followup.due",
		"lead.nurture.due",
		"lead.escalation.required"
	)
	secret = $violetSecret
	prompt = "You are Violet, VAYU's customer service agent and owner of automated lead follow-up and nurturing. For every verified inquiry or lead update, link the correct CRM account and contact, prepare the next engagement draft, recommend the channel and due time, create or update internal follow-up tasks, and identify stale leads. Present engagements and escalations to Matthew with an explicit APPROVAL REQUIRED decision; never send prospect-facing communication or make a commitment before Matthew approves it. Keep Asina informed, and report material delivery risk to Robi. Event: {payload}"
	skills = @("v-os-customer-service")
	deliver = "log"
	created_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$bridgeConfig = [ordered]@{
	url = "http://127.0.0.1:8645/webhooks/$routeName"
	secret = $secret
	route = $routeName
	violet = [ordered]@{
		url = "http://127.0.0.1:8646/webhooks/$violetRouteName"
		secret = $violetSecret
		route = $violetRouteName
		telegramEnv = "C:\Users\oneva\AppData\Local\hermes\profiles\customer-service\.env"
		paperclipAgentId = "bef25998-1beb-479b-b4ef-49b46033e471"
	}
}

[IO.File]::WriteAllText(
	$subscriptionsPath,
	(($subscriptions | ConvertTo-Json -Depth 10) + "`n"),
	[Text.UTF8Encoding]::new($false)
)
[IO.File]::WriteAllText(
	$violetSubscriptionsPath,
	(($violetSubscriptions | ConvertTo-Json -Depth 10) + "`n"),
	[Text.UTF8Encoding]::new($false)
)
[IO.File]::WriteAllText(
	$bridgeConfigPath,
	(($bridgeConfig | ConvertTo-Json -Depth 5) + "`n"),
	[Text.UTF8Encoding]::new($false)
)

Write-Output "Agent Core bridge provisioned without exposing its signing secret."
