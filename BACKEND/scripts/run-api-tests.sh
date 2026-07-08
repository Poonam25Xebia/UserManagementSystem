#!/usr/bin/env bash
# End-to-end smoke test for the User Management Service API.
# Requires: curl, node (run from the repo root so `node` resolves the `pg`
# dependency), and a reachable Postgres matching .env (used to read
# activation/recovery/deletion tokens directly, since this script does not
# have access to the real mailbox behind SendGrid).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
UNIQ=$(date +%s)
USERNAME="shuser${UNIQ}"
EMAIL="shuser${UNIQ}@example.com"
PASSWORD='Sup3r$ecretPW1'
NEW_PASSWORD='N3wSup3r$ecretPW2'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

db_query() {
  # $1 = SQL. Uses the project's own pg dependency via a one-off node script.
  node -e "
    const { Client } = require('pg');
    const c = new Client();
    c.connect().then(async () => {
      const r = await c.query(process.argv[1]);
      console.log(JSON.stringify(r.rows));
      await c.end();
    }).catch(e => { console.error(e.message); process.exit(1); });
  " "$1"
}

step() { echo; echo "=== STEP $1: $2 ==="; }

cd "$REPO_ROOT"

step 1 "Health Check"
curl -sf "$BASE_URL/health" | tee /dev/stderr

step 2 "Register User"
REG=$(curl -sf -X POST "$BASE_URL/api/v1/users/register" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"emailAddress\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"passwordConfirmation\":\"$PASSWORD\"}")
echo "$REG"
USER_ID=$(node -e "console.log(JSON.parse(process.argv[1]).userId)" "$REG")

step 3 "Activate User (token read from DB)"
ACTIVATION_TOKEN=$(db_query "SELECT token_value FROM activation_tokens WHERE user_id = '$USER_ID'" | node -e "console.log(JSON.parse(require('fs').readFileSync(0))[0].token_value)")
curl -sf -X POST "$BASE_URL/api/v1/users/activate" -H 'Content-Type: application/json' -d "{\"token\":\"$ACTIVATION_TOKEN\"}"

step 4 "Send OTP"
curl -sf -X POST "$BASE_URL/api/v1/otp/send" -H 'Content-Type: application/json' -d "{\"userId\":\"$USER_ID\"}"

step 5 "Resend OTP"
curl -sf -X POST "$BASE_URL/api/v1/otp/resend" -H 'Content-Type: application/json' -d "{\"userId\":\"$USER_ID\"}"

step 6 "Login"
LOGIN=$(curl -sf -X POST "$BASE_URL/api/v1/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN"
TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).token)" "$LOGIN")

step 7 "Call Authenticated Endpoint (request + cancel deletion)"
curl -sf -X POST "$BASE_URL/api/v1/users/deletion-requests" -H "Authorization: Bearer $TOKEN"
curl -sf -X DELETE "$BASE_URL/api/v1/users/deletion-requests" -H "Authorization: Bearer $TOKEN"

step 8 "Password Recovery"
curl -sf -X POST "$BASE_URL/api/v1/auth/password-recovery" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}"

step 9 "Password Reset (token read from DB)"
RECOVERY_TOKEN=$(db_query "SELECT token FROM password_recovery_requests WHERE user_id = '$USER_ID' ORDER BY requested_at DESC LIMIT 1" | node -e "console.log(JSON.parse(require('fs').readFileSync(0))[0].token)")
curl -sf -X POST "$BASE_URL/api/v1/auth/password-reset" -H 'Content-Type: application/json' -d "{\"recovery_token\":\"$RECOVERY_TOKEN\",\"new_password\":\"$NEW_PASSWORD\"}"

step 10 "Login Again"
LOGIN2=$(curl -sf -X POST "$BASE_URL/api/v1/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASSWORD\"}")
echo "$LOGIN2"
TOKEN2=$(node -e "console.log(JSON.parse(process.argv[1]).token)" "$LOGIN2")

step 11 "Request Account Deletion"
curl -sf -X POST "$BASE_URL/api/v1/users/deletion-requests" -H "Authorization: Bearer $TOKEN2"

step 12 "Confirm Account Deletion (token read from DB)"
DELETION_TOKEN=$(db_query "SELECT token_value FROM account_deletion_requests WHERE user_id = '$USER_ID' AND status = 'pending' ORDER BY issued_at DESC LIMIT 1" | node -e "console.log(JSON.parse(require('fs').readFileSync(0))[0].token_value)")
curl -sf -X POST "$BASE_URL/api/v1/users/deletion-requests/confirm" -H 'Content-Type: application/json' -d "{\"token\":\"$DELETION_TOKEN\"}"

step 13 "Attempt Login (must fail — account deleted)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASSWORD\"}")
if [ "$STATUS" != "401" ]; then
  echo "FAIL: expected 401, got $STATUS"
  exit 1
fi
echo "Got expected 401."

echo
echo "=== E2E COMPLETE ==="
