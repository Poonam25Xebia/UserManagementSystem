/**
 * email.validator.ts
 *
 * Email format validation for the User Registration Feature (F-01).
 * Implements FR-001 (email format) and FR-002 (pure, no side-effects).
 */

import { ValidationError } from '../errors/registration.errors';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface EmailValidator {
  validateFormat(email: string): boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultEmailValidator implements EmailValidator {
  private readonly EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  /**
   * Validates the format of the supplied email address.
   *
   * Returns `true` when the email matches the required RFC-like format.
   * Returns `false` for null, undefined, or empty string (graceful no-throw).
   *
   * Throws `ValidationError` for non-empty strings that fail validation,
   * with a specific error code depending on the nature of the failure:
   *   - MISSING_AT_SYMBOL    — no `@` character present
   *   - INVALID_CHARACTER    — `@` present but invalid chars / spaces exist
   *   - INVALID_EMAIL_FORMAT — general format mismatch
   *
   * Pure function: no DB calls, no side-effects, referentially transparent.
   */
  validateFormat(email: string): boolean {
    // Gracefully handle null / undefined / empty — return false without throwing
    if (email == null || email === '') {
      return false;
    }

    // Valid format — fast path
    if (this.EMAIL_REGEX.test(email)) {
      return true;
    }

    // Determine the specific failure reason for non-null, non-empty invalid inputs
    if (!email.includes('@')) {
      throw new ValidationError(
        'Invalid email format: missing @ symbol',
        'MISSING_AT_SYMBOL',
      );
    }

    // @ is present — check for spaces or characters outside the allowed set
    if (/[\s]/.test(email) || /[^A-Za-z0-9._%+\-@]/.test(email)) {
      throw new ValidationError(
        'Invalid email format: invalid character',
        'INVALID_CHARACTER',
      );
    }

    // Catch-all for any other format violations (e.g. missing TLD, double @, etc.)
    throw new ValidationError('Invalid email format', 'INVALID_EMAIL_FORMAT');
  }
}
