/**
 * username-uniqueness.validator.ts
 *
 * Checks that a proposed username is not already taken by any existing user,
 * regardless of their account status (pending / active / suspended).
 *
 * Requirements: FR-001–009 (US-064)
 *
 * Design notes:
 *  - Normalisation: trim() + toLowerCase() before the DB lookup.
 *  - Atomicity against concurrent registrations is delegated entirely to the
 *    UNIQUE constraint on `username_normalised` in the database.
 *  - No application-level locking; no state mutation.
 */

import { IUserRepository } from '../repositories/user.repository';
import { UsernameConflictError, ValidationError } from '../errors/registration.errors';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface UsernameUniquenessValidator {
  /**
   * Resolves normally when the username is available.
   * Rejects with ValidationError when the username is blank/null/undefined.
   * Rejects with UsernameConflictError when the username is already taken.
   */
  checkUniqueness(username: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Default implementation
// ---------------------------------------------------------------------------

export class DefaultUsernameUniquenessValidator implements UsernameUniquenessValidator {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * 1. Guard: reject blank / null / undefined values immediately.
   * 2. Normalise: trim + lowercase.
   * 3. Query the repository for any existing user with that normalised username.
   * 4. Throw UsernameConflictError if one is found; otherwise resolve void.
   */
  async checkUniqueness(username: string): Promise<void> {
    // Step 1 – validate presence
    if (username == null || username.trim() === '') {
      throw new ValidationError('A username is required.', 'USERNAME_REQUIRED');
    }

    // Step 2 – normalise
    const normalised = username.trim().toLowerCase();

    // Step 3 – query repository (read-only; no state mutation)
    const existingUser = await this.userRepository.findByNormalisedUsername(normalised);

    // Step 4 – conflict check (any status: pending, active, suspended)
    if (existingUser !== null) {
      throw new UsernameConflictError(normalised);
    }

    // No user found — username is available; resolve void implicitly.
  }
}
