# UserManagementSystem
User Management System

# Running the User Management Service Locally

The repo is split into two independently run apps:

```
UMS/
  BACKEND/   - Express/TypeScript API (this doc's main focus)
  FRONTEND/  - Vite/React UI, calls the backend over HTTP
  DOCS/      - this file and other reference docs
```

They are **not** started together by one command — run each from its own folder, in its own terminal. The backend persists to a local SQLite file (`BACKEND/data/app.db` by default) — there is no external database service to start. Redis is still required and must be running independently.

## Prerequisites

- Node.js 20.x, npm
- Redis reachable (`REDIS_URL` in `BACKEND/.env`, default `redis://localhost:6379`)
- A `BACKEND/.env` file (copy from `BACKEND/.env.example` and fill in real secrets for SendGrid/OTP/Admin — placeholders will boot the app but email delivery will fail)

## First-time setup

```powershell
cd BACKEND
npm install
npm run build
```

## Database setup

No manual database setup is required — the SQLite file at `DATABASE_PATH` (`BACKEND/.env`, default `./data/app.db`) and its containing folder are created automatically, and migrations run automatically on `npm start`/`node dist/server.js`.

To apply migrations without starting the server (e.g. in CI), run:

```powershell
cd BACKEND
npm run db:migrate
```

This is idempotent — a `schema_migrations` tracking table records which files have been applied, so re-running it is a safe no-op.

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

1. Opens the SQLite database at `DATABASE_PATH` and runs any pending migrations, and constructs one `ioredis` client (`REDIS_URL`).
2. Builds `SendGridEmailAdapter` → `EmailOtpDeliveryAdapter`.
3. Calls `createApp(...)` — mounts all 8 routers + error handler.
4. Constructs and `.start()`s `OutboxWorker` (F-01 email queue, 30s poll) and `AccountDeletionNotificationWorker` (F-04 email queue, 30s poll).
5. `app.listen(PORT)` (default 3000).
6. `SIGINT`/`SIGTERM` → stop both workers → close HTTP server → close the SQLite handle + Redis → exit.

There is no separate "wait for Redis ready" step — if Redis is unreachable at boot, the app still starts and binds the port; `GET /health` reports `db_reachable` for the SQLite file (always reachable once the file is created) and most OTP-rate-limit routes will fail on first use if Redis is down. Ensure Redis is up **before** `npm start`.

## Verifying it's running

```powershell
curl http://localhost:3000/health
# {"status":"ok","db_reachable":true}
```

See `DOCS/API_REFERENCE.md` for the full endpoint list, and `DOCS/postman/UMS.postman_collection.json` / `BACKEND/tests/api.http` for ready-to-run requests.

## Running tests

```powershell
cd BACKEND
npm run test:unit          # no external dependencies (mocked db/Redis)
npm run test:integration   # requires a reachable Redis (see .env); each spec gets its own isolated SQLite file
```

**Note on integration tests**: each spec file (`src/integration/*.spec.ts`) now gets its own isolated SQLite database file (via `src/integration/test-db.ts`), so there's no shared-table truncation race between files.

## Fixes applied during verification (Phase 6)

_The table below predates the PostgreSQL → SQLite migration and is kept as a historical record of that verification pass; it no longer reflects the current (SQLite-backed) database layer._

| # | Root cause | Fix applied | Affected file(s) | Verification |
|---|---|---|---|---|
| 1 | `src/services/account-deletion.service.ts`'s `confirmDeletion` UPDATE query reused parameter `$2` in two different SQL type contexts (`username = $2` and `lower($2)`), which Postgres cannot type-infer consistently → `42P08 inconsistent types deduced for parameter $2` on every deletion confirmation | Compute the normalized username in JS (`anonymizedUsername.toLowerCase()`) and pass it as its own bound parameter (`$3`) instead of relying on SQL `lower()` reusing `$2` | `src/services/account-deletion.service.ts`; updated the corresponding mock-query destructuring in `src/services/account-deletion.service.property.test.ts` to match the new 5-parameter order | Full manual E2E flow (13 steps, including account-deletion confirm) now returns `200` instead of `500`; `npm run test:unit` — 139/139 pass; `npm run test:integration` (serial) — 36/36 pass |
| 2 | `test:integration` script ran Jest without `--runInBand`; the 4 integration spec files share one live Postgres DB and each truncates common tables in `afterEach`, so concurrent execution races and intermittently wipes another file's in-flight test data | Added `--runInBand` to the `test:integration` npm script | `package.json` | Re-ran `npm run test:integration` after the change — 36/36 pass consistently (previously 11/36 failed when run concurrently) |
| 3 | `.env`'s `PGHOST=localhost` couldn't reach WSL Ubuntu's Postgres because a native Windows PostgreSQL 17 service already occupies port 5432, shadowing WSL's localhost-forwarding | Set `PGHOST` to the WSL VM's IP (`172.21.176.161`) directly, with a comment documenting the conflict and how to refresh the IP or resolve it permanently | `.env` | `node -e` pg client connected successfully; app booted and `/health` returned `db_reachable: true` |
| 4 | WSL Postgres role `postgres` had no password set for TCP/password auth (only OS-level peer auth worked), so the app's `PGPASSWORD=postgres` was rejected | `ALTER USER postgres WITH PASSWORD 'postgres';` inside WSL; also set `listen_addresses = '*'` and added a `pg_hba.conf` rule for the WSL/Windows bridge subnet so the VM IP is reachable from Windows | WSL Postgres config only (no repo files changed) | Same as above |
