/**
 * password.controller.ts
 *
 * Entry point for POST /api/v1/auth/password-recovery and
 * POST /api/v1/auth/password-reset.
 *
 * The recovery endpoint always returns 202 with an identical body regardless
 * of whether the submitted email corresponds to a registered account — this
 * is the HTTP-layer half of the anti-enumeration guarantee whose service-layer
 * half lives in PasswordRecoveryService.requestRecovery (FR-013).
 *
 * Error mapping (reset):
 *   TokenNotFoundException          → 404  TOKEN_NOT_FOUND
 *   TokenExpiredException           → 410  TOKEN_EXPIRED (reconciled, not 400)
 *   PasswordPolicyViolationException → 422 PASSWORD_POLICY_VIOLATION { violations }
 *   malformed body                  → 400
 *   unexpected                      → 500
 *
 * Requirements: US-036 FR-012, FR-014, FR-017; US-039 FR-012, FR-014, FR-017
 */

import { Request, Response } from 'express';
import { PasswordRecoveryService } from '../services/password-recovery.service';
import {
  TokenNotFoundException,
  TokenExpiredException,
  PasswordPolicyViolationException,
} from '../errors/login.errors';

export class PasswordController {
  constructor(private readonly passwordRecoveryService: PasswordRecoveryService) {}

  /**
   * Handle POST /api/v1/auth/password-recovery
   */
  async requestRecovery(req: Request, res: Response): Promise<void> {
    const email = req.body.email as string | undefined;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      res.status(400).json({ error: 'email is required.' });
      return;
    }

    try {
      await this.passwordRecoveryService.requestRecovery(email.trim());
    } catch (err) {
      // requestRecovery is designed to never throw (FR-013) — an exception
      // here indicates an infrastructure failure, not an enumeration signal.
      console.error('[PasswordController] Unexpected error during password recovery:', err);
    }

    // Identical response whether or not the account exists — do not branch
    // on the outcome above.
    res.status(202).json({
      message: 'If that email is registered, a recovery link has been sent.',
    });
  }

  /**
   * Handle POST /api/v1/auth/password-reset
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    const recoveryToken = req.body.recovery_token as string | undefined;
    const newPassword = req.body.new_password as string | undefined;

    if (!recoveryToken || typeof recoveryToken !== 'string' || recoveryToken.trim() === '') {
      res.status(400).json({ error: 'recovery_token is required.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword === '') {
      res.status(400).json({ error: 'new_password is required.' });
      return;
    }

    try {
      await this.passwordRecoveryService.resetPassword(recoveryToken.trim(), newPassword);
      res.status(200).json({ message: 'Password has been reset. Please log in again.' });
    } catch (err) {
      if (err instanceof TokenNotFoundException) {
        res.status(404).json({
          error_code: 'TOKEN_NOT_FOUND',
          message: err.message,
        });
      } else if (err instanceof TokenExpiredException) {
        res.status(410).json({
          error_code: 'TOKEN_EXPIRED',
          message: err.message,
        });
      } else if (err instanceof PasswordPolicyViolationException) {
        res.status(422).json({
          error_code: 'PASSWORD_POLICY_VIOLATION',
          violations: err.violations,
        });
      } else {
        console.error('[PasswordController] Unexpected error during password reset:', err);
        res.status(500).json({ error: 'An unexpected error occurred during password reset.' });
      }
    }
  }
}
