# Frontend Integration Guide

## Base URL

Local: `http://localhost:3000`. All endpoints are under `/api/v1/...` except `/health` and `/api-docs` (Swagger UI, live).

## Authentication

Two independent bearer-token schemes, never interchangeable:

1. **Session token** (`POST /api/v1/auth/login` → `token`): send as `Authorization: Bearer <token>` on the two authenticated deletion-request routes. Expires after `SESSION_EXPIRY_SECONDS` (3600s default); a `401` with `error_code: SESSION_EXPIRED` means re-login is required.
2. **Admin bearer token** (static, server-configured `ADMIN_BEARER_TOKEN`): only for `POST /api/v1/admin/users/:user_id/resend-confirmation`. Not obtainable via any API call — out of scope for an end-user frontend.

There are no refresh tokens and no cookie-based sessions. Store the session token in memory or `sessionStorage`/`localStorage` per your app's security posture; it is a bearer credential, so treat it like one (no auto-attach via cookies/CSRF protection exists — none is needed since it's not cookie-based).

## Headers

- `Content-Type: application/json` on every request with a body.
- `Authorization: Bearer <token>` only on the routes listed above.
- No CSRF token, no API key header, no request-signing required.

## CORS

**Fixed during this readiness pass** — the app previously had zero CORS middleware, which would have hard-blocked any browser-based frontend on a different origin. `cors` is now mounted globally in `src/app.ts`, reflecting the request's `Origin` header by default (safe because auth is Bearer-token based, not cookie-based — no CSRF surface). Set `FRONTEND_ORIGIN` in `.env` to your frontend's deployed URL once known, to lock this down to a single allowed origin instead of reflecting any origin.

## Request bodies and response schemas

See `docs/API_REFERENCE.md` for the full per-endpoint contract (request body shape, success schema, every error status+code) and `docs/openapi.yaml` / `http://localhost:3000/api-docs` for the machine-readable version. Highlights to design UI around:

- **Field naming is camelCase in registration** (`emailAddress`, `passwordConfirmation`) but **snake_case in login/password/deletion** (`recovery_token`, `new_password`, `retry_after`). Not a bug — just inconsistent across features; build your API client layer to normalize this once, rather than per-call.
- **Error body casing is inconsistent**: some endpoints return `errorCode` (registration, activation, OTP), others `error_code` (login, password, deletion, session middleware). Check both when parsing errors generically, or map each endpoint's error shape explicitly — do not assume one casing app-wide.
- **OTP has no verification endpoint.** `/otp/send` and `/otp/resend` only confirm dispatch (`202 { status: "accepted" | "dispatch_failed" }`); the plaintext code is never returned by the API (by design — it only ever appears in the delivered email). If your frontend needs an "enter the code" flow, there is currently no backend endpoint to check user-submitted codes against `otp_requests.code_hash` — this is a real gap for OTP-based verification UX, not a documentation gap. Flag this if OTP is meant to gate any action.
- **`/health` always returns 200.** Do not use it to detect backend outages that specifically involve the database — check the `db_reachable` field in the body instead of relying on HTTP status.
- **Password recovery is intentionally silent about account existence** (`202` regardless). Don't build a "check your email" vs. "no such account" branch in the UI — there is only one response.
- **Logout is idempotent** (`200` even for an already-invalidated token) — don't treat a second logout call as an error case.

## Status codes actually used (cross-endpoint)

`200, 201, 202, 400, 401, 403, 404, 409, 410, 422, 423, 429, 500` — no `204 No Content` anywhere (every success response has a JSON body, even if just a `message`).

## Known issues fixed during backend readiness verification

- **CORS**: added (see above) — previously would have blocked all browser frontends.
- **Account-deletion confirmation** (`POST /api/v1/users/deletion-requests/confirm`) previously returned `500` unconditionally due to a backend SQL bug — fixed and verified (see `docs/RUN_APPLICATION.md`).

## Known gaps / follow-ups before public frontend integration

1. **No OTP verification endpoint** (see above) — if any user-facing flow needs to confirm a submitted OTP code, this must be added to the backend first.
2. **No global HTTP rate limiting** on registration, activation, password-recovery, or deletion-request routes (only OTP has one, at the service layer). A frontend should not rely on the backend to throttle rapid retries from a single client on these routes.
3. **No request/access logging** — if the frontend team needs correlation IDs or request tracing for debugging integration issues, none exist yet (only ad hoc `console.log`/`console.error`).
4. **Field-naming and error-casing inconsistency** (documented above) — worth a follow-up cleanup pass if a shared TypeScript client/OpenAPI-generated SDK is planned, since a single generated client will surface these inconsistencies directly in generated types.
5. **`FRONTEND_ORIGIN` is unset by default** — fine for local dev (reflects any origin), but must be set to the real frontend origin before any production-like deployment.
