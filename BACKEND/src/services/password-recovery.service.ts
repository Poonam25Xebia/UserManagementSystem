/**
 * password-recovery.service.ts
 *
 * Anti-enumeration password recovery request handling and token-gated
 * password reset.
 *
 * requestRecovery(email) sequence (FR-012–013):
 *  1. Look up user by email.
 *  2. Unknown email -> return silently (no DB write, no notification, no
 *     error) so the HTTP response is identical whether or not the account
 *     exists.
 *  3. Known email -> create a recovery token (base64url, matching F-01's
 *     activation-token convention) and dispatch it via EmailDeliveryPort
 *     (reused from F-01 — no new provider integration needed).
 *
 * resetPassword(recoveryToken, newPassword) sequence (FR-014–018):
 *  1. Find token by value          -> TokenNotFoundException if not found
 *  2. Check not expired/consumed   -> TokenExpiredException otherwise
 *     (reconciled to 410, not 400 — see design.md Requirements Reconciliation #3)
 *  3. Evaluate password policy     -> PasswordPolicyViolationException on violation
 *     (reuses F-01's PasswordPolicyEvaluator/passwordPolicyConfig — one policy,
 *     one evaluator, per design.md Requirements Reconciliation #5)
 *  4. Atomic UPDATE: password_hash + token consumed + all sessions invalidated
 *     -> commit all three or roll back (FR-018)
 *
 * Requirements: US-036 FR-012–018; US-039 FR-012–018
 */

import crypto from 'crypto';
import type { Database } from 'better-sqlite3';
import { withTransaction } from '../db/with-transaction';
import { IUserRepository } from '../repositories/user.repository';
import { IPasswordRecoveryRequestRepository } from '../repositories/password-recovery-request.repository';
import { PasswordPolicyEvaluator } from '../validators/password-policy.evaluator';
import { PasswordHasher } from './password-hasher';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import {
  TokenNotFoundException,
  TokenExpiredException,
  PasswordPolicyViolationException,
} from '../errors/login.errors';
import { passwordPolicyConfig } from '../config/password-policy.config';
import { appConfig } from '../config/app.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PasswordRecoveryService {
  /** Never throws for an unknown email — resolves silently either way (FR-013). */
  requestRecovery(email: string): Promise<void>;
  resetPassword(recoveryToken: string, newPassword: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultPasswordRecoveryService implements PasswordRecoveryService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly recoveryRequestRepository: IPasswordRecoveryRequestRepository,
    private readonly passwordPolicyEvaluator: PasswordPolicyEvaluator,
    private readonly passwordHasher: PasswordHasher,
    private readonly notificationPort: EmailDeliveryPort,
    private readonly db: Database,
  ) {}

  /**
   * @throws never — an unknown email is a silent no-op, matching the known-
   *         email branch's externally observable behavior (FR-013).
   */
  async requestRecovery(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (user === null) {
      return;
    }

    const token = crypto.randomBytes(96).toString('base64url');
    const requestedAt = new Date();
    const expiresAt = new Date(
      requestedAt.getTime() + appConfig.passwordRecoveryTokenExpiryHours * 60 * 60 * 1000,
    );

    await this.recoveryRequestRepository.insert(user.id, token, requestedAt, expiresAt);

    const recoveryLink = `${appConfig.passwordRecoveryBaseUrl}/reset-password?token=${token}`;
    await this.notificationPort.sendTransactional(
      { address: user.email, name: user.username },
      'Reset your password',
      appConfig.passwordRecoveryEmailTemplateId,
      { recoveryLink, displayName: user.username },
    );
  }

  /**
   * @throws TokenNotFoundException          - token not found in system
   * @throws TokenExpiredException           - token past expiresAt, or already consumed
   * @throws PasswordPolicyViolationException - newPassword fails the shared policy
   */
  async resetPassword(recoveryToken: string, newPassword: string): Promise<void> {
    // --- Step 1: Look up token ---
    const request = await this.recoveryRequestRepository.findByToken(recoveryToken);
    if (request === null) {
      throw new TokenNotFoundException();
    }

    // --- Step 2: Check expiry / consumed (reconciled to 410) ---
    const now = new Date();
    if (request.consumed || now > request.expiresAt) {
      throw new TokenExpiredException();
    }

    // --- Step 3: Password policy (shared with F-01) ---
    const policyResult = this.passwordPolicyEvaluator.evaluate(newPassword, passwordPolicyConfig);
    if (!policyResult.valid) {
      throw new PasswordPolicyViolationException(policyResult.violations);
    }

    const newPasswordHash = await this.passwordHasher.hash(newPassword);

    // --- Step 4: Atomic UPDATE — password hash + token consumed + sessions invalidated (FR-018) ---
    await withTransaction(this.db, () => {
      this.db
        .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
        .run(newPasswordHash, request.userId);

      this.db
        .prepare(`UPDATE password_recovery_requests SET consumed = 1, consumed_at = ? WHERE id = ?`)
        .run(now.toISOString(), request.id);

      this.db
        .prepare(`UPDATE sessions SET invalidated = 1, invalidated_at = ? WHERE user_id = ? AND invalidated = 0`)
        .run(now.toISOString(), request.userId);
    });
  }
}
