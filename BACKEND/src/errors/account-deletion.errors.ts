/**
 * account-deletion.errors.ts
 *
 * Custom domain error classes for the Account Deletion Feature (F-04).
 * All errors extend the built-in Error class so they are instanceof-compatible
 * with standard JS error handling, matching the convention established in
 * registration.errors.ts / login.errors.ts.
 */

// ---------------------------------------------------------------------------
// Deletion-request errors (US-022)
// ---------------------------------------------------------------------------

/**
 * Thrown when a user requests deletion while a 'pending' request already
 * exists for their account (Requirements Reconciliation #2 — one active
 * request per user, enforced in the service layer rather than a raw DB
 * constraint so this maps cleanly to 409).
 */
export class DeletionRequestAlreadyPendingException extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super('A deletion request is already pending for this account.');
    this.name = 'DeletionRequestAlreadyPendingException';
    this.userId = userId;
    Object.setPrototypeOf(this, DeletionRequestAlreadyPendingException.prototype);
  }
}

/**
 * Thrown when cancelling a deletion request but no 'pending' request exists
 * for the calling user (US-022 FR-007).
 */
export class DeletionRequestNotFoundException extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super('No pending deletion request was found for this account.');
    this.name = 'DeletionRequestNotFoundException';
    this.userId = userId;
    Object.setPrototypeOf(this, DeletionRequestNotFoundException.prototype);
  }
}

// ---------------------------------------------------------------------------
// Confirmation OTP errors (US-023)
// ---------------------------------------------------------------------------

/**
 * Thrown when the deletion confirmation code has passed its expiry window.
 */
export class DeletionOtpExpiredException extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super('The deletion confirmation code has expired. Please request a new one.');
    this.name = 'DeletionOtpExpiredException';
    this.userId = userId;
    Object.setPrototypeOf(this, DeletionOtpExpiredException.prototype);
  }
}

/**
 * Thrown when the deletion confirmation code does not match the pending
 * request's hash. No attempt-count lockout — bounded only by expiry, matching
 * otp.service.ts's verifyOtp convention.
 */
export class DeletionOtpInvalidException extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super('The deletion confirmation code is incorrect.');
    this.name = 'DeletionOtpInvalidException';
    this.userId = userId;
    Object.setPrototypeOf(this, DeletionOtpInvalidException.prototype);
  }
}

// AccountNotActiveException is reused directly from login.errors.ts (F-03) —
// requesting deletion for a non-active account is the same failure mode as
// logging into one; no separate class is introduced here.
export { AccountNotActiveException } from './login.errors';
