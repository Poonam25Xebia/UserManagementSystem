/**
 * login.errors.ts
 *
 * Custom domain error classes for the User Login Feature (F-03).
 * All errors extend the built-in Error class so they are instanceof-compatible
 * with standard JS error handling, matching the convention established in
 * registration.errors.ts.
 *
 * Requirements: US-036 FR-001–020, US-038 FR-001–010, US-039 FR-001–019
 */

// ---------------------------------------------------------------------------
// Login / credential errors (US-036, US-039)
// ---------------------------------------------------------------------------

/**
 * Thrown when the submitted email does not match a registered account, or the
 * password does not match the stored hash. Deliberately identical for both
 * causes — callers MUST map this to the same HTTP 401 response in either case
 * to avoid account enumeration (FR-002, EC-004).
 */
export class InvalidCredentialsException extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsException';
    Object.setPrototypeOf(this, InvalidCredentialsException.prototype);
  }
}

/**
 * Thrown when a login is attempted against an account whose status is not
 * 'active' (e.g. still 'pending' or 'suspended').
 */
export class AccountNotActiveException extends Error {
  public readonly accountStatus: string;

  constructor(status: string) {
    super(`Account is not active (current status: '${status}').`);
    this.name = 'AccountNotActiveException';
    this.accountStatus = status;
    Object.setPrototypeOf(this, AccountNotActiveException.prototype);
  }
}

/**
 * Thrown when a login is attempted while the account is temporarily locked
 * out due to consecutive failed attempts (US-036 FR-008). Distinct from
 * AccountNotActiveException — a lockout is a self-clearing throttle, not an
 * admin-driven status change.
 */
export class AccountLockedException extends Error {
  public readonly retryAfter: Date;

  constructor(retryAfter: Date) {
    super('Too many failed login attempts. Try again later.');
    this.name = 'AccountLockedException';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, AccountLockedException.prototype);
  }
}

// ---------------------------------------------------------------------------
// Session errors (US-038)
// ---------------------------------------------------------------------------

/**
 * Thrown when session persistence fails after credentials have already been
 * verified (EC-006). Callers should NOT re-verify credentials on retry.
 */
export class SessionCreationFailedException extends Error {
  constructor() {
    super('Failed to create a session. Please try again.');
    this.name = 'SessionCreationFailedException';
    Object.setPrototypeOf(this, SessionCreationFailedException.prototype);
  }
}

/**
 * Thrown by consumers that require a hard failure for an unrecognised session
 * token. SessionService.validateSession() itself returns a typed result
 * instead of throwing — this class exists for callers (e.g. middleware) that
 * need to raise/map an exception instead.
 */
export class SessionNotFoundException extends Error {
  constructor() {
    super('No matching session was found for the provided token.');
    this.name = 'SessionNotFoundException';
    Object.setPrototypeOf(this, SessionNotFoundException.prototype);
  }
}

export class SessionExpiredException extends Error {
  constructor() {
    super('The session has expired. Please log in again.');
    this.name = 'SessionExpiredException';
    Object.setPrototypeOf(this, SessionExpiredException.prototype);
  }
}

export class SessionInvalidatedException extends Error {
  constructor() {
    super('The session has been invalidated. Please log in again.');
    this.name = 'SessionInvalidatedException';
    Object.setPrototypeOf(this, SessionInvalidatedException.prototype);
  }
}

// ---------------------------------------------------------------------------
// Password recovery / reset errors (US-036, US-039)
//
// TokenNotFoundException and TokenExpiredException are reused directly from
// registration.errors.ts (F-01) — the shape (no fields beyond message/name)
// is identical whether the token in question is an activation token or a
// password-recovery token; callers construct a `new TokenNotFoundException()`
// / `new TokenExpiredException()` instance per use, scoped by which
// repository raised it rather than by a distinct class.
// ---------------------------------------------------------------------------

export { TokenNotFoundException, TokenExpiredException } from './registration.errors';

/**
 * Thrown when a new password submitted during password reset fails the
 * shared PasswordPolicyEvaluator (F-01). F-01's own registration flow
 * surfaces policy violations directly from PasswordValidationResult without
 * a dedicated exception class; this feature introduces one because
 * PasswordRecoveryService.resetPassword() needs a throwable to short-circuit
 * before the transactional DB write (US-036 FR-017).
 */
export class PasswordPolicyViolationException extends Error {
  public readonly violations: string[];

  constructor(violations: string[]) {
    super('The new password does not meet the required complexity rules.');
    this.name = 'PasswordPolicyViolationException';
    this.violations = violations;
    Object.setPrototypeOf(this, PasswordPolicyViolationException.prototype);
  }
}
