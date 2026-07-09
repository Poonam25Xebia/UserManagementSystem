/**
 * otp.service.ts
 *
 * Core OTP issuance logic for send and resend flows (US-002).
 *
 * sendOtp / resendOtp share identical rules:
 *   1. Load user by id.
 *   2. Unknown user       -> return an accepted result without disclosure.
 *   3. Inactive/suspended -> throw OtpForbiddenError (mapped to 403 upstream).
 *   4. Rate limit exceeded -> throw OtpRateLimitExceededError (mapped to 429).
 *   5. Invalidate any existing active OTP for the user.
 *   6. Generate a numeric OTP and hash it with a keyed HMAC before persisting.
 *   7. Persist the OTP request with expiry = createdAt + OTP_TTL_MINUTES.
 *   8. Dispatch the code to the user's email address.
 *   9. Record delivery status as `delivered` or `failed` based on the
 *      provider outcome, but always report `accepted: true` to the caller —
 *      dispatch failure is tracked for observability, not surfaced as an error.
 *
 * Requirements: US-002 FR-002, FR-003, FR-004, FR-005, FR-006, FR-009, FR-010
 */

import crypto from 'crypto';
import type { Database } from 'better-sqlite3';
import { withTransaction } from '../db/with-transaction';
import { IUserRepository } from '../repositories/user.repository';
import { IOtpRequestRepository } from '../repositories/otp-request.repository';
import { RateLimitGuard } from './rate-limit.guard';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import { OtpDispatchResult } from '../types/otp.types';
import {
  OtpForbiddenError,
  OtpRateLimitExceededError,
  OtpNotFoundError,
  OtpExpiredError,
  OtpInvalidError,
} from '../errors/otp.errors';
import { otpConfig } from '../config/otp.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface OtpVerifyResult {
  userId: string;
  activatedAt: Date;
}

export interface OtpService {
  sendOtp(userId: string): Promise<OtpDispatchResult>;
  resendOtp(userId: string): Promise<OtpDispatchResult>;
  verifyOtp(userId: string, passcode: string): Promise<OtpVerifyResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random numeric code of the given length,
 * zero-padded (e.g. length 6 -> "004821").
 */
function generateNumericCode(length: number): string {
  const upperBoundExclusive = 10 ** length;
  const value = crypto.randomInt(0, upperBoundExclusive);
  return value.toString().padStart(length, '0');
}

/**
 * Hash a plaintext OTP code with a keyed HMAC so the persisted value is
 * non-reversible. Plaintext is never stored.
 */
function hashOtpCode(code: string): string {
  return crypto
    .createHmac(otpConfig.otpHashAlgorithm, otpConfig.otpHashSecret)
    .update(code)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultOtpService implements OtpService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly otpRequestRepository: IOtpRequestRepository,
    private readonly rateLimitGuard: RateLimitGuard,
    private readonly otpDeliveryPort: OtpDeliveryPort,
    private readonly db: Database,
  ) {}

  async sendOtp(userId: string): Promise<OtpDispatchResult> {
    return this.issueOtp(userId);
  }

  async resendOtp(userId: string): Promise<OtpDispatchResult> {
    return this.issueOtp(userId);
  }

  /**
   * Verify a submitted OTP code and, on success, activate the user's account.
   *
   * @throws OtpNotFoundError - no active (non-invalidated) OTP exists for the user.
   * @throws OtpExpiredError  - the active OTP's expiry has passed.
   * @throws OtpInvalidError  - the submitted code does not match.
   */
  async verifyOtp(userId: string, passcode: string): Promise<OtpVerifyResult> {
    const user = await this.userRepository.findById(userId);
    if (user === null || (user.status !== 'pending' && user.status !== 'active')) {
      throw new OtpNotFoundError(userId);
    }

    const request = await this.otpRequestRepository.findActiveByUserId(userId);
    if (request === null) {
      throw new OtpNotFoundError(userId);
    }

    if (new Date() > request.expiresAt) {
      throw new OtpExpiredError(userId);
    }

    const submittedHash = Buffer.from(hashOtpCode(passcode));
    const storedHash = Buffer.from(request.codeHash);
    const matches =
      submittedHash.length === storedHash.length &&
      crypto.timingSafeEqual(submittedHash, storedHash);

    if (!matches) {
      throw new OtpInvalidError(userId);
    }

    const activatedAt = new Date();
    await withTransaction(this.db, () => {
      this.db
        .prepare(`UPDATE users SET status = 'active', activated_at = ? WHERE id = ?`)
        .run(activatedAt.toISOString(), userId);

      this.db
        .prepare(`UPDATE otp_requests SET invalidated_at = ? WHERE id = ?`)
        .run(activatedAt.toISOString(), request.id);
    });

    return { userId, activatedAt };
  }

  /**
   * Shared send/resend implementation — see file-level doc comment for the
   * full rule sequence.
   *
   * @throws OtpForbiddenError         - account is not active.
   * @throws OtpRateLimitExceededError - too many attempts within the window.
   */
  private async issueOtp(userId: string): Promise<OtpDispatchResult> {
    const user = await this.userRepository.findById(userId);

    if (user === null) {
      // Never disclose whether a given user id exists.
      return { accepted: true, status: 'delivered' };
    }

    // Both freshly-registered ('pending') and already-verified ('active')
    // accounts may request an OTP — 'pending' covers post-registration
    // activation, 'active' covers any future login step-up/re-verification use.
    if (user.status !== 'active' && user.status !== 'pending') {
      throw new OtpForbiddenError(userId, user.status);
    }

    const allowed = await this.rateLimitGuard.allow(userId);
    if (!allowed) {
      throw new OtpRateLimitExceededError(userId);
    }

    await this.otpRequestRepository.invalidateActiveByUserId(userId);

    const code = generateNumericCode(otpConfig.otpLength);
    const codeHash = hashOtpCode(code);

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + otpConfig.otpTtlMinutes * 60 * 1000);
    const attemptSequence = await this.otpRequestRepository.getNextAttemptSequence(userId);

    const request = await this.otpRequestRepository.create({
      userId,
      emailAddress: user.email,
      codeHash,
      status: 'pending',
      createdAt,
      expiresAt,
      invalidatedAt: null,
      attemptSequence,
    });

    const dispatchSucceeded = await this.otpDeliveryPort.dispatch(user.email, code);

    if (dispatchSucceeded) {
      await this.otpRequestRepository.markDelivered(request.id);
      return { accepted: true, status: 'delivered' };
    }

    await this.otpRequestRepository.markFailed(request.id);
    return { accepted: true, status: 'failed' };
  }
}
