# Running the User Management Service Locally

The repo is split into two independently run apps:

```
UMS/
  BACKEND/   - Express/TypeScript API (this doc's main focus)
  FRONTEND/  - Vite/React UI, calls the backend over HTTP
  DOCS/      - this file and other reference docs
```

They are **not** started together by one command — run each from its own folder, in its own terminal. No Docker Compose exists in this repo — Postgres and Redis must be running independently. This machine's setup: **Postgres runs inside WSL Ubuntu**, not natively on Windows (see the note in `BACKEND/.env` about `PGHOST`).

## Prerequisites

- Node.js 20.x, npm
- PostgreSQL 14+ reachable (this environment: WSL Ubuntu, Postgres 16)
- Redis reachable (this environment: WSL Ubuntu, forwarded to Windows `localhost:6379` automatically)
- A `BACKEND/.env` file (copy from `BACKEND/.env.example` and fill in real secrets for SendGrid/OTP/Admin — placeholders will boot the app but email delivery will fail)

## ⚠️ Known local environment quirk (WSL + native Windows Postgres conflict)

A native Windows PostgreSQL 17 service was found already listening on `localhost:5432`, which shadows WSL Ubuntu's Postgres 16 instance (also on port 5432) — Windows processes connecting to `localhost:5432` reach the **Windows** service, not WSL's, even though WSL is the intended database.

Until the Windows service is stopped (requires admin/UAC), `BACKEND/.env` points `PGHOST` at the WSL VM's IP directly instead of `localhost`:

```
PGHOST=172.21.176.161   # WSL VM IP — changes across WSL/Windows restarts!
```

**If the app fails to connect to Postgres after a reboot**, refresh this IP:
```powershell
wsl hostname -I
```
and update `PGHOST` in `BACKEND/.env` with the first address returned.

**Permanent fix** (recommended, requires an elevated PowerShell you run yourself):
```powershell
Stop-Service -Name 'postgresql-x64-17' -Force
# Optionally: Set-Service -Name 'postgresql-x64-17' -StartupType Disabled
```
Once the Windows service is stopped, WSL2's localhost-forwarding takes over and `PGHOST=localhost` works normally (no need to track the WSL IP).

## First-time setup

```powershell
cd BACKEND
npm install
npm run build
```

## Database setup

Migrations already applied in this environment (verified: all 8 expected tables exist in `ums_db`). For a fresh database:

```powershell
# Inside WSL, as the postgres OS user (peer auth):
wsl -d Ubuntu -u postgres -- psql -c "CREATE DATABASE ums_db;"
wsl -d Ubuntu -u postgres -- psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"

# From the BACKEND/ folder (Windows), with .env's PG* vars loaded:
cd BACKEND
npm run db:migrate
```

**⚠️ The migration runner is not idempotent** (`db/migrations/run-migrations.ts` has no tracking table — it always runs its full hardcoded 10-file list). Re-running `npm run db:migrate` against a database that already has these tables will fail with `relation "X" already exists`. There is no built-in rollback command; each `.sql` file has a commented-out `DROP TABLE ... CASCADE` you can run manually in reverse order (010 → 001) to tear down and re-migrate:

```sql
-- Reset (manual, run in psql against ums_db, in this order):
DROP TABLE IF EXISTS account_deletion_notification_records CASCADE;
DROP TABLE IF EXISTS account_deletion_requests CASCADE;
DROP TABLE IF EXISTS password_recovery_requests CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
-- (005/008 alter users — re-running 001 after a users drop recreates the base table but
--  005/008's ALTER statements must be replayed too; simplest to drop+recreate the whole DB)
DROP TABLE IF EXISTS otp_requests CASCADE;
DROP TABLE IF EXISTS registration_email_records CASCADE;
DROP TABLE IF EXISTS activation_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```
For a clean reset, dropping and recreating the whole `ums_db` database is simpler than selective table drops (avoids missing the 005/008 `ALTER TABLE users` migrations).

## Starting the backend

```powershell
cd BACKEND
npm run build
npm start
```
Or for development iteration: `node dist/server.js` after `npm run build`, or run via the VS Code debugger (`.vscode/launch.json` — see `DOCS/FRONTEND_INTEGRATION_GUIDE.md`/Phase 14 configs).

Expected startup log:
```
User Management Service listening on port 3000
```

## Starting the frontend

The frontend is a separate Vite/React app in `FRONTEND/` and is started independently, in its own terminal, once the backend is up:

```powershell
cd FRONTEND
npm install
npm run dev
```

Vite serves the UI at `http://localhost:5173` by default. It talks to the backend over plain HTTP/CORS (`FRONTEND/src/app/lib/api-client.ts`), reading the backend's base URL from `VITE_API_BASE_URL` (falls back to `http://localhost:3000` if unset — matches the backend's default `PORT`). To point at a different backend URL, create `FRONTEND/.env` with:

```
VITE_API_BASE_URL=http://localhost:3000
```

For a production-style build: `npm run build` (outputs to `FRONTEND/dist/`).

**CORS note**: the backend's `FRONTEND_ORIGIN` env var (in `BACKEND/.env`) controls which origin is allowed to call it. Leave it empty during local dev (backend defaults to allowing any origin) or set it to `http://localhost:5173` to match Vite's dev server.

### Startup order (what `server.ts` does)

1. Constructs a single `pg.Pool()` (reads `PG*` env vars) and one `ioredis` client (`REDIS_URL`).
2. Builds `SendGridEmailAdapter` → `EmailOtpDeliveryAdapter`.
3. Calls `createApp(...)` — mounts all 8 routers + error handler.
4. Constructs and `.start()`s `OutboxWorker` (F-01 email queue, 30s poll) and `AccountDeletionNotificationWorker` (F-04 email queue, 30s poll).
5. `app.listen(PORT)` (default 3000).
6. `SIGINT`/`SIGTERM` → stop both workers → close HTTP server → close Pool + Redis → exit.

There is no separate "wait for DB/Redis ready" step — if Postgres/Redis are unreachable at boot, the app still starts and binds the port; `GET /health` will report `db_reachable: false` and most routes will 500 on first DB query. Ensure Postgres/Redis are up **before** `npm start`.

## Verifying it's running

```powershell
curl http://localhost:3000/health
# {"status":"ok","db_reachable":true}
```

See `DOCS/API_REFERENCE.md` for the full endpoint list, and `DOCS/postman/UMS.postman_collection.json` / `BACKEND/tests/api.http` for ready-to-run requests.

## Running tests

```powershell
cd BACKEND
npm run test:unit          # 139 tests, no external dependencies (mocked pg/Redis)
npm run test:integration   # 36 tests, requires a real reachable Postgres + Redis (see .env)
```

**Note on integration tests**: each spec file (`src/integration/*.spec.ts`) truncates shared tables (`users`, `sessions`, etc.) in its own `afterEach` hook, since they run against a real, persistent database rather than an isolated fixture. Jest runs spec files concurrently by default, and concurrent truncation across files racing on the same live DB causes spurious failures (observed and confirmed during Phase 6 verification). `package.json`'s `test:integration` script now passes `--runInBand` to force serial execution — do not remove this flag, or intermittent cross-file failures will return.

## Fixes applied during verification (Phase 6)

| # | Root cause | Fix applied | Affected file(s) | Verification |
|---|---|---|---|---|
| 1 | `src/services/account-deletion.service.ts`'s `confirmDeletion` UPDATE query reused parameter `$2` in two different SQL type contexts (`username = $2` and `lower($2)`), which Postgres cannot type-infer consistently → `42P08 inconsistent types deduced for parameter $2` on every deletion confirmation | Compute the normalized username in JS (`anonymizedUsername.toLowerCase()`) and pass it as its own bound parameter (`$3`) instead of relying on SQL `lower()` reusing `$2` | `src/services/account-deletion.service.ts`; updated the corresponding mock-query destructuring in `src/services/account-deletion.service.property.test.ts` to match the new 5-parameter order | Full manual E2E flow (13 steps, including account-deletion confirm) now returns `200` instead of `500`; `npm run test:unit` — 139/139 pass; `npm run test:integration` (serial) — 36/36 pass |
| 2 | `test:integration` script ran Jest without `--runInBand`; the 4 integration spec files share one live Postgres DB and each truncates common tables in `afterEach`, so concurrent execution races and intermittently wipes another file's in-flight test data | Added `--runInBand` to the `test:integration` npm script | `package.json` | Re-ran `npm run test:integration` after the change — 36/36 pass consistently (previously 11/36 failed when run concurrently) |
| 3 | `.env`'s `PGHOST=localhost` couldn't reach WSL Ubuntu's Postgres because a native Windows PostgreSQL 17 service already occupies port 5432, shadowing WSL's localhost-forwarding | Set `PGHOST` to the WSL VM's IP (`172.21.176.161`) directly, with a comment documenting the conflict and how to refresh the IP or resolve it permanently | `.env` | `node -e` pg client connected successfully; app booted and `/health` returned `db_reachable: true` |
| 4 | WSL Postgres role `postgres` had no password set for TCP/password auth (only OS-level peer auth worked), so the app's `PGPASSWORD=postgres` was rejected | `ALTER USER postgres WITH PASSWORD 'postgres';` inside WSL; also set `listen_addresses = '*'` and added a `pg_hba.conf` rule for the WSL/Windows bridge subnet so the VM IP is reachable from Windows | WSL Postgres config only (no repo files changed) | Same as above |
