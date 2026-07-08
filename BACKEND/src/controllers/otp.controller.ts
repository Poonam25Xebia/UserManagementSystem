/**
 * otp.controller.ts
 *
 * Entry point for POST /api/v1/otp/send, POST /api/v1/otp/resend, and
 * POST /api/v1/otp/verify.
 *
 * Request body (send/resend): { userId: string }
 * Request body (verify):      { userId: string, passcode: string }
 *
 * Response mapping (send/resend):
 *   accepted (delivered)        -> 202 { status: 'accepted' }
 *   accepted (dispatch failed)  -> 202 { status: 'dispatch_failed' }
 *   OtpForbiddenError           -> 403 OTP_FORBIDDEN
 *   OtpRateLimitExceededError   -> 429 OTP_RATE_LIMIT_EXCEEDED
 *   malformed body              -> 400
 *   unexpected                  -> 500
 *
 * Response mapping (verify):
 *   success                     -> 200 { message, userId, activatedAt }
 *   OtpNotFoundError            -> 404 OTP_NOT_FOUND
 *   OtpExpiredError             -> 410 OTP_EXPIRED
 *   OtpInvalidError             -> 422 OTP_INVALID
 *   malformed body              -> 400
 *   unexpected                  -> 500
 *
 * The plaintext OTP is never returned in any response.
 *
 * Requirements: US-002 FR-011, FR-012, FR-013; US-005 FR-001–012
 */

import { Request, Response } from 'express';
import { OtpService } from '../services/otp.service';
import {
  OtpForbiddenError,
  OtpRateLimitExceededError,
  OtpNotFoundError,
  OtpExpiredError,
  OtpInvalidError,
} from '../errors/otp.errors';

export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  /**
   * Handle POST /api/v1/otp/send
   */
  async sendOtp(req: Request, res: Response): Promise<void> {
    await this.handle(req, res, (userId) => this.otpService.sendOtp(userId));
  }

  /**
   * Handle POST /api/v1/otp/resend
   */
  async resendOtp(req: Request, res: Response): Promise<void> {
    await this.handle(req, res, (userId) => this.otpService.resendOtp(userId));
  }

  /**
   * Handle POST /api/v1/otp/verify
   */
  async verifyOtp(req: Request, res: Response): Promise<void> {
    const userId = req.body.userId as string | undefined;
    const passcode = req.body.passcode as string | undefined;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      res.status(400).json({ error: 'userId is required.' });
      return;
    }

    if (!passcode || typeof passcode !== 'string' || passcode.trim() === '') {
      res.status(400).json({ error: 'passcode is required.' });
      return;
    }

    try {
      const result = await this.otpService.verifyOtp(userId.trim(), passcode.trim());
      res.status(200).json({
        message: 'Account activated successfully.',
        userId: result.userId,
        activatedAt: result.activatedAt,
      });
    } catch (err) {
      if (err instanceof OtpNotFoundError) {
        res.status(404).json({ errorCode: 'OTP_NOT_FOUND', message: err.message });
        return;
      }

      if (err instanceof OtpExpiredError) {
        res.status(410).json({ errorCode: 'OTP_EXPIRED', message: err.message });
        return;
      }

      if (err instanceof OtpInvalidError) {
        res.status(422).json({ errorCode: 'OTP_INVALID', message: err.message });
        return;
      }

      console.error('[OtpController] Unexpected error during verification:', err);
      res.status(500).json({ error: 'An unexpected error occurred while verifying the OTP.' });
    }
  }

  private async handle(
    req: Request,
    res: Response,
    invoke: (userId: string) => ReturnType<OtpService['sendOtp']>,
  ): Promise<void> {
    const userId = req.body.userId as string | undefined;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      res.status(400).json({ error: 'userId is required.' });
      return;
    }

    try {
      const result = await invoke(userId.trim());
      res.status(202).json({
        status: result.status === 'delivered' ? 'accepted' : 'dispatch_failed',
      });
    } catch (err) {
      if (err instanceof OtpForbiddenError) {
        res.status(403).json({ errorCode: 'OTP_FORBIDDEN', message: err.message });
        return;
      }

      if (err instanceof OtpRateLimitExceededError) {
        res.status(429).json({ errorCode: 'OTP_RATE_LIMIT_EXCEEDED', message: err.message });
        return;
      }

      console.error('[OtpController] Unexpected error:', err);
      res.status(500).json({ error: 'An unexpected error occurred while processing the OTP request.' });
    }
  }
}
