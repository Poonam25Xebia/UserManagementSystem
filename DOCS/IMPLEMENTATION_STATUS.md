# Implementation Status vs. `.kiro` Implementation Plans

Validated by reading each feature's `design.md`/`requirements.md`/`tasks.md` against the actual `src/` code. All file:line references were verified against the live repository.

## Summary

| Feature | Status |
|---|---|
| F-01 User Registration | **Implemented** — fully matches design.md |
| F-02 OTP Delivery | **Implemented** — functionally complete, one documented deviation (email transport instead of SMS) |
| F-03 User Login | **Implemented** — fully matches design.md, including the cross-feature suspension-check broadening required by F-04 |
| F-04 Account Deletion | **Implemented** — fully matches design.md |

No **Missing**, **Broken**, or **Not Wired** items were found. All 8 routers are mounted in `src/app.ts`; no orphaned controllers/services exist.

## F-01 Registration

| Item | Status | Evidence |
|---|---|---|
| Registration Controller | Implemented | `src/controllers/registration.controller.ts:28-112` |
| Registration Service | Implemented | `src/services/registration.service.ts` |
| Validators | Implemented | `src/validators/{registration,email,username-uniqueness}.validator.ts`, `password-policy.evaluator.ts` |
| UserRepository | Implemented | `src/repositories/user.repository.ts` (shared across F-01/F-03/F-04) |
| Activation flow | Implemented | `src/controllers/activation.controller.ts`, `src/services/activation.service.ts`, `src/repositories/token.repository.ts` |
| Email dispatch | Implemented | `src/services/email-dispatch.service.ts`, `src/adapters/sendgrid-email.adapter.ts` |
| Outbox Worker | Implemented | `src/workers/outbox.worker.ts`, started in `server.ts:23-28,36` |

## F-02 OTP Delivery

| Item | Status | Evidence |
|---|---|---|
| OTP Controller | Implemented | `src/controllers/otp.controller.ts:25-74` |
| OTP Service | Implemented | `src/services/otp.service.ts:69-139` |
| RateLimit Guard | Implemented | `src/services/rate-limit.guard.ts:27-54` (Redis `INCR`+`EXPIRE`, key `otp:rl:{user_id}`) |
| OTP Repository | Implemented | `src/repositories/otp-request.repository.ts` against `db/migrations/004_create_otp_requests.sql` |
| Email Delivery Adapter | Implemented (email, not SMS) | `src/adapters/email-otp-delivery.adapter.ts` wrapping `SendGridEmailAdapter` |

**Deviation (self-documented in code, not a defect):** `otp.md`/`design.md` describe SMS delivery (`phone_number` column, `SmsDeliveryPort`). The implementation delivers OTPs via email instead, reusing F-01's SendGrid infrastructure behind the same `OtpDeliveryPort` interface. Called out in `email-otp-delivery.adapter.ts`'s header comment and `db/migrations/004_create_otp_requests.sql`'s header comment, referencing "`.kiro/specs/otp/tasks.md` task 2 deviation note." No action needed — document this for frontend/QA so OTP test flows check email inboxes, not SMS.

## F-03 User Login

| Item | Status | Evidence |
|---|---|---|
| Login Controller | Implemented | `src/controllers/auth.controller.ts:35-123` |
| Auth Service | Implemented | `src/services/auth.service.ts` |
| Session Service | Implemented | `src/services/session.service.ts:50-143` |
| Session Middleware | Implemented | `src/middleware/session-validation.middleware.ts:32-78` — applied only to F-04's deletion routes (by design; login/logout/recovery/reset are pre-auth) |
| Password Recovery | Implemented | `src/controllers/password.controller.ts`, `src/services/password-recovery.service.ts` |
| Health Endpoint | Implemented | `src/controllers/health.controller.ts:17-36`, mounted at root `GET /health` |

## F-04 Account Deletion

| Item | Status | Evidence |
|---|---|---|
| Controller | Implemented | `src/controllers/deletion.controller.ts:33-114` |
| Service | Implemented | `src/services/account-deletion.service.ts` (atomic 4-way transaction on confirm) |
| Notification Worker | Implemented | `src/workers/account-deletion-notification.worker.ts:34-114`, started in `server.ts:31-34,37` |
| Repository | Implemented | `src/repositories/deletion-request.repository.ts`, `deletion-notification-record.repository.ts` |
| Routes | Implemented | `src/routes/deletion.routes.ts:33-67` — request/cancel are session-guarded, confirm is token-guarded (unauthenticated) |

## Route Inventory (all mounted, verified against `src/app.ts`)

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/users/register` | none |
| POST | `/api/v1/users/activate` | token in body |
| POST | `/api/v1/admin/users/:user_id/resend-confirmation` | Admin bearer token (extra route, not in original list — spec-driven, see F-01 design.md) |
| POST | `/api/v1/otp/send` | none |
| POST | `/api/v1/otp/resend` | none |
| POST | `/api/v1/auth/login` | none |
| POST | `/api/v1/auth/logout` | Bearer session token |
| POST | `/api/v1/auth/password-recovery` | none |
| POST | `/api/v1/auth/password-reset` | token in body |
| POST | `/api/v1/users/deletion-requests` | Bearer session token |
| DELETE | `/api/v1/users/deletion-requests` | Bearer session token |
| POST | `/api/v1/users/deletion-requests/confirm` | token in body |
| GET | `/health` | none |

All 12 originally-expected routes exist at the expected method+path. Only extra route found: the admin resend-confirmation endpoint, which is legitimate and spec-driven (not a mismatch).

## Architectural Notes (not defects, worth knowing)

- `DefaultSessionService` is constructed twice (once per router that needs it) rather than shared as one singleton. Both instances are stateless and DB-backed, so this causes no behavioral bug.
- Migration runner has no tracking table (see `docs/RUN_APPLICATION.md` for safe re-run guidance).
- No CORS/Helmet/request-logging middleware — flagged in `docs/FRONTEND_INTEGRATION_GUIDE.md` as an action item before public frontend integration.
