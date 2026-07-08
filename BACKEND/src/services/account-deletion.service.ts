/**
 * account-deletion.service.ts
 *
 * Self-service account deletion: request (OTP-gated), confirm (anonymize +
 * finalize), and cancel a still-pending request.
 *
 * requestDeletion(userId) sequence (US-022 FR-001–003; US-023 FR-001–004):
 *  1. Look up user           -> AccountNotActiveException if missing or not 'active'
 *  2. Check for an existing 'pending' request for this user
 *                             -> DeletionRequestAlreadyPendingException if one exists
 *                             (Requirements Reconciliation #2 — one active request per user)
 *  3. Generate a 6-digit numeric OTP code, hash it with a keyed HMAC
 *     (mirrors otp.service.ts's convention), and persist a 'pending' request
 *     row holding only the hash — the plaintext code is never stored.
 *  4. Dispatch the confirmation email containing the plaintext code via
 *     EmailDeliveryPort (best-effort, not queued — matches US-023's own lack
 *     of a retry requirement here, unlike the post-deletion notice below).
 *
 * confirmDeletion(userId, code) sequence (US-023 FR-005–007; US-022 FR-004–006; US-033 FR-001–006):
 *  1. Find the caller's pending request -> DeletionRequestNotFoundException if none
 *     (confirm is session-authenticated — the code is checked against the
 *     caller's own pending request, not looked up globally)
 *  2. Check not expired        -> DeletionOtpExpiredException otherwise
 *  3. Timing-safe hash compare -> DeletionOtpInvalidException on mismatch
 *     (no attempt-count lockout — bounded only by expiry, matching
 *     otp.service.ts's verifyOtp convention)
 *  4. Capture the owning user's email BEFORE anonymizing it
 *  5. Atomic transaction: anonymize + mark 'deleted'; mark the request
 *     'confirmed'; invalidate all of the user's sessions; queue a
 *     post-deletion notification record with the captured email
 *     -> commit all four or roll back (design.md Correctness Properties #3–4)
 *
 * cancelDeletion(userId) sequence (US-022 FR-007):
 *  1. Find the caller's 'pending' request -> DeletionRequestNotFoundException if none
 *  2. Mark it 'cancelled'
 *
 * Requirements: US-022 FR-001–008; US-023 FR-001–007; US-033 FR-001–006
 */

import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { IUserRepository } from '../repositories/user.repository';
import { IDeletionRequestRepository } from '../repositories/deletion-request.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import {
  DeletionRequestResult,
  DeletionConfirmationResult,
} from '../types/account-deletion.types';
import {
  DeletionRequestAlreadyPendingException,
  DeletionRequestNotFoundException,
  DeletionOtpExpiredException,
  DeletionOtpInvalidException,
  AccountNotActiveException,
} from '../errors/account-deletion.errors';
import { accountDeletionConfig } from '../config/account-deletion.config';
import { otpConfig } from '../config/otp.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AccountDeletionService {
  requestDeletion(userId: string): Promise<DeletionRequestResult>;
  confirmDeletion(userId: string, code: string): Promise<DeletionConfirmationResult>;
  cancelDeletion(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers — mirror otp.service.ts's generateNumericCode/hashOtpCode
// ---------------------------------------------------------------------------

function generateNumericCode(length: number): string {
  const upperBoundExclusive = 10 ** length;
  const value = crypto.randomInt(0, upperBoundExclusive);
  return value.toString().padStart(length, '0');
}

function hashCode(code: string): string {
  return crypto
    .createHmac(otpConfig.otpHashAlgorithm, otpConfig.otpHashSecret)
    .update(code)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultAccountDeletionService implements AccountDeletionService {
  /**
   * Note: no DeletionNotificationRecordRepository dependency here — the
   * 'queued' notification row inserted by confirmDeletion() MUST commit
   * atomically with the user/request/session writes, so it is written via
   * the same raw PoolClient transaction rather than through the repository
   * (which only ever talks to `pool`, not a specific transaction's client).
   * This mirrors PasswordRecoveryService.resetPassword()'s own use of raw
   * SQL for the `sessions` table instead of going through SessionRepository.
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly deletionRequestRepository: IDeletionRequestRepository,
    private readonly notificationPort: EmailDeliveryPort,
    private readonly pool: Pool,
  ) {}

  /**
   * @throws AccountNotActiveException             - user missing or not 'active'
   * @throws DeletionRequestAlreadyPendingException - a 'pending' request already exists
   */
  async requestDeletion(userId: string): Promise<DeletionRequestResult> {
    // --- Step 1: Account must exist and be active ---
    const user = await this.userRepository.findById(userId);
    if (user === null || user.status !== 'active') {
      throw new AccountNotActiveException(user?.status ?? 'unknown');
    }

    // --- Step 2: At most one pending request per user (Reconciliation #2) ---
    const existing = await this.deletionRequestRepository.findPendingByUserId(userId);
    if (existing !== null) {
      throw new DeletionRequestAlreadyPendingException(userId);
    }

    // --- Step 3: Generate a 6-digit OTP code and persist only its hash ---
    const code = generateNumericCode(6);
    const codeHash = hashCode(code);
    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + accountDeletionConfig.otpExpiryMinutes * 60 * 1000,
    );

    const request = await this.deletionRequestRepository.insert(
      userId,
      codeHash,
      issuedAt,
      expiresAt,
    );

    // --- Step 4: Dispatch the confirmation email with the plaintext code ---
    await this.notificationPort.sendTransactional(
      { address: user.email, name: user.username },
      'Confirm your account deletion',
      accountDeletionConfig.requestEmailTemplateId,
      {
        code,
        displayName: user.username,
        expiry_minutes: String(accountDeletionConfig.otpExpiryMinutes),
      },
    );

    return { requestId: request.id, expiresAt };
  }

  /**
   * @throws DeletionRequestNotFoundException - no 'pending' request exists for this user
   * @throws DeletionOtpExpiredException      - the pending request's code has expired
   * @throws DeletionOtpInvalidException      - the submitted code does not match
   */
  async confirmDeletion(userId: string, code: string): Promise<DeletionConfirmationResult> {
    // --- Step 1: Look up the caller's own pending request ---
    const request = await this.deletionRequestRepository.findPendingByUserId(userId);
    if (request === null) {
      throw new DeletionRequestNotFoundException(userId);
    }

    // --- Step 2: Check expiry ---
    const now = new Date();
    if (now > request.expiresAt) {
      throw new DeletionOtpExpiredException(userId);
    }

    // --- Step 3: Timing-safe code comparison ---
    const submittedHash = Buffer.from(hashCode(code));
    const storedHash = Buffer.from(request.codeHash);
    const matches =
      submittedHash.length === storedHash.length &&
      crypto.timingSafeEqual(submittedHash, storedHash);

    if (!matches) {
      throw new DeletionOtpInvalidException(userId);
    }

    // --- Step 4: Capture the pre-anonymization email ---
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new DeletionRequestNotFoundException(userId);
    }
    const preservedEmail = user.email;

    // --- Step 5: Atomic transaction — anonymize, confirm, invalidate sessions, queue notice ---
    const anonymizedEmail = `deleted-${user.id}@deleted.invalid`;
    const anonymizedUsername = `deleted-user-${user.id}`;
    const deletedAt = now;

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE users
         SET status = 'deleted', email = $1, username = $2, username_normalised = $3, deleted_at = $4
         WHERE id = $5`,
        [anonymizedEmail, anonymizedUsername, anonymizedUsername.toLowerCase(), deletedAt, user.id],
      );

      await client.query(
        `UPDATE account_deletion_requests
         SET status = 'confirmed', confirmed_at = $1
         WHERE id = $2`,
        [deletedAt, request.id],
      );

      await client.query(
        `UPDATE sessions
         SET invalidated = true, invalidated_at = $1
         WHERE user_id = $2 AND invalidated = false`,
        [deletedAt, user.id],
      );

      await client.query(
        `INSERT INTO account_deletion_notification_records
           (user_id, recipient_address, deletion_date, delivery_status)
         VALUES ($1, $2, $3, 'queued')`,
        [user.id, preservedEmail, deletedAt],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { userId: user.id, deletedAt };
  }

  /**
   * @throws DeletionRequestNotFoundException - no 'pending' request exists for this user
   */
  async cancelDeletion(userId: string): Promise<void> {
    const request = await this.deletionRequestRepository.findPendingByUserId(userId);
    if (request === null) {
      throw new DeletionRequestNotFoundException(userId);
    }

    await this.deletionRequestRepository.updateStatus(request.id, 'cancelled', new Date());
  }
}
