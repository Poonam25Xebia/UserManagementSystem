/**
 * login.types.ts
 *
 * All shared TypeScript interfaces and domain types for the
 * User Login Feature (F-03).
 *
 * Requirements: US-036 FR-001–020, US-038 FR-001–010, US-039 FR-001–019
 */

// ---------------------------------------------------------------------------
// Request / Result DTOs — Login
// ---------------------------------------------------------------------------

/**
 * Incoming payload for the POST /api/v1/auth/login endpoint.
 * password is the raw plaintext string — NEVER logged, NEVER persisted.
 */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/**
 * Returned by AuthService.login() on success.
 * token is the raw session token, returned to the caller exactly once.
 */
export interface LoginResult {
  token: string;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Session domain entity and results (US-038)
// ---------------------------------------------------------------------------

/**
 * Persisted session record. tokenHash stores SHA-256(raw token); the raw
 * token itself is NEVER persisted or logged.
 */
export interface SessionEntity {
  id: string; // UUID v4
  userId: string; // FK -> users.id
  tokenHash: string; // SHA-256 hex digest of the raw token
  createdAt: Date;
  expiresAt: Date;
  invalidated: boolean; // default false
  invalidatedAt: Date | null;
}

/**
 * Result returned by SessionService.validateSession().
 * Never throws for a missing/expired/invalidated token — callers switch on
 * `valid` and, when false, on `reason`.
 */
export type SessionValidationResult =
  | { valid: true; userId: string }
  | {
      valid: false;
      reason: 'NOT_FOUND' | 'EXPIRED' | 'INVALIDATED' | 'ACCOUNT_SUSPENDED';
    };

/**
 * Result returned by SessionService.invalidateSession().
 * alreadyTerminated is true when the presented token was already
 * not-found / invalidated / expired — this is NOT an error case (EC-005).
 */
export interface LogoutResult {
  alreadyTerminated: boolean;
}

// ---------------------------------------------------------------------------
// Password recovery domain entity (US-036, US-039)
// ---------------------------------------------------------------------------

/**
 * Persisted password-recovery request. token is a 128-char base64url string,
 * matching the F-01 activation-token convention.
 */
export interface PasswordRecoveryRequestEntity {
  id: string; // UUID v4
  userId: string; // FK -> users.id
  token: string; // opaque, 128-char cryptographically random string
  requestedAt: Date;
  expiresAt: Date; // requestedAt + PASSWORD_RECOVERY_TOKEN_EXPIRY_HOURS
  consumed: boolean; // default false
  consumedAt: Date | null;
}
