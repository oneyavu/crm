$env:PAPERCLIP_BRIDGE_SECRET = [Environment]::GetEnvironmentVariable(
	"VAYU_PAPERCLIP_BRIDGE_SECRET",
	"User"
)
$env:PAPERCLIP_COMPANY_ID = "39bd1e1f-9f50-4017-9d6e-c82fb6025e93"
$env:PAPERCLIP_URL = "http://127.0.0.1:3100"
$env:CRM_API_URL = "https://api.asina.onevayu.com"

& "C:\Users\oneva\AppData\Local\Microsoft\WinGet\Links\bun.exe" `
	"C:\Users\oneva\Documents\Codex\2026-08-08\ins\crm\apps\api\scripts\paperclip-bridge.mjs"
