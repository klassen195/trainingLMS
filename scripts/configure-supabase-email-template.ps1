param(
  [string]$ProjectRef = "mhqywvhmlpmoxpzhvgda",
  [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN
)

$ErrorActionPreference = "Stop"

if (-not $AccessToken) {
  Write-Host "Missing SUPABASE_ACCESS_TOKEN."
  Write-Host "Create one at https://supabase.com/dashboard/account/tokens"
  Write-Host "Then run:"
  Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "your-token"'
  Write-Host "  .\scripts\configure-supabase-email-template.ps1"
  exit 1
}

$subject = "Sign in to TrainingLMS"
$body = @'
<h2>Sign in to TrainingLMS</h2>
{{ if .RedirectTo }}
<p>Click the link below to sign in. This link expires shortly and can only be used once.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
{{ else }}
<p>Your sign-in code is:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 0.2em;">{{ .Token }}</p>
<p>Enter this code on the login page. It expires shortly.</p>
{{ end }}
'@

$payload = @{
  mailer_subjects_magic_link = $subject
  mailer_templates_magic_link_content = $body
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Method Patch `
  -Uri "https://api.supabase.com/v1/projects/$ProjectRef/config/auth" `
  -Headers @{
    Authorization = "Bearer $AccessToken"
    "Content-Type" = "application/json"
  } `
  -Body $payload

Write-Host "Updated Magic Link email template for project $ProjectRef."
Write-Host "Subject: $($response.mailer_subjects_magic_link)"
