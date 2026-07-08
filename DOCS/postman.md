# Postman / curl Reference — UMS API

Base URL (local): `http://localhost:3000`
All routes are prefixed with `/api/v1` except `/health` and `/api-docs`.

Two auth schemes are used:
- **Session bearer token** — returned by `POST /api/v1/auth/login`, sent as `Authorization: Bearer <token>`.
- **Admin bearer token** — static secret from the `ADMIN_BEARER_TOKEN` env var, sent as `Authorization: Bearer <ADMIN_BEARER_TOKEN>`.

Set these as Postman environment variables: `base_url`, `session_token`, `admin_token`.

---

## 1. Registration

### Register a new user
`POST /api/v1/users/register` — no auth

```bash
curl -X POST http://localhost:3000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jdoe",
    "emailAddress": "jdoe@example.com",
    "password": "P@ssw0rd123!",
    "passwordConfirmation": "P@ssw0rd123!"
  }'
```

Responses: `201` success · `422` validation/password-policy failure · `409 USERNAME_UNAVAILABLE`.

---

## 2. Account Activation

### Activate account
`POST /api/v1/users/activate` — no auth (activation token is the credential)

```bash
curl -X POST http://localhost:3000/api/v1/users/activate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<ACTIVATION_TOKEN>"
  }'
```

---

## 3. Auth

### Login
`POST /api/v1/auth/login` — no auth

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jdoe@example.com",
    "password": "P@ssw0rd123!"
  }'
```

Success `200`: `{ "token": "<session_token>", "expires_at": "ISO date" }` — save `token` as `session_token`.
Errors: `401 AUTH_INVALID_CREDENTIALS` · `403 AUTH_ACCOUNT_NOT_ACTIVE` · `423 AUTH_ACCOUNT_LOCKED`.

### Logout
`POST /api/v1/auth/logout` — requires session bearer token

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <session_token>"
```

---

## 4. Password Recovery

### Request password recovery
`POST /api/v1/auth/password-recovery` — no auth

```bash
curl -X POST http://localhost:3000/api/v1/auth/password-recovery \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jdoe@example.com"
  }'
```

Always returns `202` (anti-enumeration).

### Reset password
`POST /api/v1/auth/password-reset` — no auth (recovery token is the credential)

```bash
curl -X POST http://localhost:3000/api/v1/auth/password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "recovery_token": "<RECOVERY_TOKEN>",
    "new_password": "NewP@ssw0rd123!"
  }'
```

Errors: `404 TOKEN_NOT_FOUND` · `410 TOKEN_EXPIRED` · `422 PASSWORD_POLICY_VIOLATION`.

---

## 5. OTP

### Send OTP
`POST /api/v1/otp/send` — no auth

```bash
curl -X POST http://localhost:3000/api/v1/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<USER_ID>"
  }'
```

### Resend OTP
`POST /api/v1/otp/resend` — no auth

```bash
curl -X POST http://localhost:3000/api/v1/otp/resend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<USER_ID>"
  }'
```

Both: `202 { "status": "accepted" | "dispatch_failed" }` · `403 OTP_FORBIDDEN` · `429 OTP_RATE_LIMIT_EXCEEDED`.

---

## 6. Account Deletion

### Request account deletion
`POST /api/v1/users/deletion-requests` — requires session bearer token

```bash
curl -X POST http://localhost:3000/api/v1/users/deletion-requests \
  -H "Authorization: Bearer <session_token>"
```

### Cancel account deletion request
`DELETE /api/v1/users/deletion-requests` — requires session bearer token

```bash
curl -X DELETE http://localhost:3000/api/v1/users/deletion-requests \
  -H "Authorization: Bearer <session_token>"
```

### Confirm account deletion
`POST /api/v1/users/deletion-requests/confirm` — no auth (confirmation token is the credential)

```bash
curl -X POST http://localhost:3000/api/v1/users/deletion-requests/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<DELETION_CONFIRMATION_TOKEN>"
  }'
```

---

## 7. Admin

### Resend confirmation email for a user
`POST /api/v1/admin/users/:user_id/resend-confirmation` — requires admin bearer token

```bash
curl -X POST http://localhost:3000/api/v1/admin/users/<USER_ID>/resend-confirmation \
  -H "Authorization: Bearer <admin_token>"
```

---

## 8. Health Check

`GET /health` — no auth

```bash
curl http://localhost:3000/health
```

Response: `{ "status": "ok", "db_reachable": true }`

---

## Suggested test flow

1. `POST /api/v1/users/register`
2. `POST /api/v1/users/activate` (use activation token from email/logs)
3. `POST /api/v1/auth/login` → save `session_token`
4. Exercise protected routes (`deletion-requests`, `logout`) with `Authorization: Bearer <session_token>`
5. `POST /api/v1/auth/password-recovery` → `POST /api/v1/auth/password-reset`
6. `POST /api/v1/otp/send` / `resend`
7. Admin flow: set `ADMIN_BEARER_TOKEN` in `.env`, use it as `admin_token`

> Note: a ready-made Postman collection/environment already exists at `postman/UMS.postman_collection.json` and `postman/UMS.postman_environment.json` — import those directly if you'd rather not build requests by hand.
