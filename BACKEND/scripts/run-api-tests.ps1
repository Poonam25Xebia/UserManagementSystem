# End-to-end smoke test for the User Management Service API.
# Requires: PowerShell, Node.js (run from the repo root so `node` resolves
# the `pg` dependency), and a reachable Postgres matching .env (used to read
# activation/recovery/deletion tokens directly, since this script does not
# have access to the real mailbox behind SendGrid).
$ErrorActionPreference = 'Stop'

$BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:3000' }
$Uniq = [int][double]::Parse((Get-Date -UFormat %s))
$Username = "psuser$Uniq"
$Email = "psuser$Uniq@example.com"
$Password = 'Sup3r$ecretPW1'
$NewPassword = 'N3wSup3r$ecretPW2'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Step($n, $name) {
  Write-Host ""
  Write-Host "=== STEP $n`: $name ===" -ForegroundColor Cyan
}

function Invoke-DbQuery($sql) {
  $script = @"
const { Client } = require('pg');
const c = new Client();
c.connect().then(async () => {
  const r = await c.query(process.argv[1]);
  console.log(JSON.stringify(r.rows));
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
"@
  $result = node -e $script $sql
  return $result | ConvertFrom-Json
}

Step 1 "Health Check"
$health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
$health | ConvertTo-Json

Step 2 "Register User"
$regBody = @{ username = $Username; emailAddress = $Email; password = $Password; passwordConfirmation = $Password } | ConvertTo-Json
$reg = Invoke-RestMethod -Uri "$BaseUrl/api/v1/users/register" -Method Post -ContentType 'application/json' -Body $regBody
$reg | ConvertTo-Json
$userId = $reg.userId

Step 3 "Activate User (token read from DB)"
$activationRows = Invoke-DbQuery "SELECT token_value FROM activation_tokens WHERE user_id = '$userId'"
$activationToken = $activationRows[0].token_value
Invoke-RestMethod -Uri "$BaseUrl/api/v1/users/activate" -Method Post -ContentType 'application/json' -Body (@{ token = $activationToken } | ConvertTo-Json) | ConvertTo-Json

Step 4 "Send OTP"
Invoke-RestMethod -Uri "$BaseUrl/api/v1/otp/send" -Method Post -ContentType 'application/json' -Body (@{ userId = $userId } | ConvertTo-Json) | ConvertTo-Json

Step 5 "Resend OTP"
Invoke-RestMethod -Uri "$BaseUrl/api/v1/otp/resend" -Method Post -ContentType 'application/json' -Body (@{ userId = $userId } | ConvertTo-Json) | ConvertTo-Json

Step 6 "Login"
$login = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
$login | ConvertTo-Json
$token = $login.token

Step 7 "Call Authenticated Endpoint (request + cancel deletion)"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "$BaseUrl/api/v1/users/deletion-requests" -Method Post -Headers $headers | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/api/v1/users/deletion-requests" -Method Delete -Headers $headers | ConvertTo-Json

Step 8 "Password Recovery"
Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/password-recovery" -Method Post -ContentType 'application/json' -Body (@{ email = $Email } | ConvertTo-Json) | ConvertTo-Json

Step 9 "Password Reset (token read from DB)"
$recoveryRows = Invoke-DbQuery "SELECT token FROM password_recovery_requests WHERE user_id = '$userId' ORDER BY requested_at DESC LIMIT 1"
$recoveryToken = $recoveryRows[0].token
Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/password-reset" -Method Post -ContentType 'application/json' -Body (@{ recovery_token = $recoveryToken; new_password = $NewPassword } | ConvertTo-Json) | ConvertTo-Json

Step 10 "Login Again"
$login2 = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email = $Email; password = $NewPassword } | ConvertTo-Json)
$login2 | ConvertTo-Json
$token2 = $login2.token

Step 11 "Request Account Deletion"
Invoke-RestMethod -Uri "$BaseUrl/api/v1/users/deletion-requests" -Method Post -Headers @{ Authorization = "Bearer $token2" } | ConvertTo-Json

Step 12 "Confirm Account Deletion (token read from DB)"
$deletionRows = Invoke-DbQuery "SELECT token_value FROM account_deletion_requests WHERE user_id = '$userId' AND status = 'pending' ORDER BY issued_at DESC LIMIT 1"
$deletionToken = $deletionRows[0].token_value
Invoke-RestMethod -Uri "$BaseUrl/api/v1/users/deletion-requests/confirm" -Method Post -ContentType 'application/json' -Body (@{ token = $deletionToken } | ConvertTo-Json) | ConvertTo-Json

Step 13 "Attempt Login (must fail - account deleted)"
try {
  Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email = $Email; password = $NewPassword } | ConvertTo-Json)
  Write-Host "FAIL: expected 401, request succeeded" -ForegroundColor Red
  exit 1
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  if ($statusCode -ne 401) {
    Write-Host "FAIL: expected 401, got $statusCode" -ForegroundColor Red
    exit 1
  }
  Write-Host "Got expected 401." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== E2E COMPLETE ===" -ForegroundColor Green
