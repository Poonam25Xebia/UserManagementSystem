/**
 * password-hasher.ts
 *
 * Shared bcrypt-backed password hashing/comparison abstraction, used by both
 * the User Login Feature (F-03, AuthService.login / PasswordRecoveryService)
 * and (going forward) Registration (F-01), which currently calls bcrypt
 * inline in registration.service.ts. Introduced here because design.md's
 * DefaultAuthService takes an injected PasswordHasher collaborator, and the
 * same abstraction is reused for password-reset hashing in a later task.
 *
 * Requirements: US-036 FR-004 (constant-time comparison via bcrypt.compare)
 */

import bcrypt from 'bcrypt';
import { appConfig } from '../config/app.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly costFactor: number = appConfig.bcryptCostFactor) {}

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.costFactor);
  }

  /**
   * Constant-time comparison against the stored bcrypt hash. Never throws on
   * a non-matching password — resolves to `false`.
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
