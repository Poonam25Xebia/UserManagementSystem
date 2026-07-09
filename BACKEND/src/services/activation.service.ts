/**
 * activation.service.ts
 *
 * Validates an activation token and transitions a user account from
 * 'pending' → 'active'.  All checks follow the exact sequence from design.md.
 *
 * Sequence (US-074 FR-001–015):
 *  1. Find token by value          → TokenNotFoundException if not found
 *  2. Check token not expired       → TokenExpiredException if past expiresAt
 *  3. Check token not consumed      → TokenConsumedException if already used
 *  4. Find user; check status       → AccountNotPendingException if not pending
 *  5. Atomic UPDATE: user + token   → commit both or roll back
 *
 * Idempotency: concurrent duplicate activations are serialised by the DB
 * transaction + the consumed flag.
 */

import type { Database } from 'better-sqlite3';
import { withTransaction } from '../db/with-transaction';
import { ActivationResult } from '../types/registration.types';
import { ITokenRepository } from '../repositories/token.repository';
import { IUserRepository } from '../repositories/user.repository';
import {
  TokenNotFoundException,
  TokenExpiredException,
  TokenConsumedException,
  AccountNotPendingException,
} from '../errors/registration.errors';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ActivationService {
  activate(tokenValue: string): Promise<ActivationResult>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultActivationService implements ActivationService {
  constructor(
    private readonly tokenRepository: ITokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly db: Database,
  ) {}

  /**
   * Activate an account using the supplied token value.
   *
   * @param tokenValue - Opaque 128-char base64url token from the activation email.
   * @returns ActivationResult { userId, activatedAt } on success.
   * @throws  TokenNotFoundException       — token not found in system
   * @throws  TokenExpiredException        — token past its expiresAt
   * @throws  TokenConsumedException       — token already used
   * @throws  AccountNotPendingException   — account not in 'pending' state
   */
  async activate(tokenValue: string): Promise<ActivationResult> {
    // --- Step 1: Look up token (FR-002) ---
    const token = await this.tokenRepository.findByTokenValue(tokenValue);
    if (token === null) {
      throw new TokenNotFoundException();
    }

    // --- Step 2: Check expiry (FR-004) ---
    const now = new Date();
    if (now > token.expiresAt) {
      throw new TokenExpiredException();
    }

    // --- Step 3: Check consumed flag (FR-006) ---
    if (token.consumed) {
      throw new TokenConsumedException();
    }

    // --- Step 4: Check account status (FR-008) ---
    const user = await this.userRepository.findById(token.userId);
    if (user === null || user.status !== 'pending') {
      throw new AccountNotPendingException(user?.status ?? 'unknown');
    }

    // --- Step 5: Atomic UPDATE — user status + token consumed (FR-010–011) ---
    const activatedAt = new Date();
    await withTransaction(this.db, () => {
      this.db
        .prepare(`UPDATE users SET status = 'active', activated_at = ? WHERE id = ?`)
        .run(activatedAt.toISOString(), user.id);

      this.db
        .prepare(`UPDATE activation_tokens SET consumed = 1, consumed_at = ? WHERE id = ?`)
        .run(activatedAt.toISOString(), token.id);
    });

    // --- Return result (FR-012, FR-015) ---
    return { userId: user.id, activatedAt };
  }
}
