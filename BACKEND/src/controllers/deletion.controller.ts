/**
 * deletion.controller.ts
 *
 * Entry point for the Account Deletion Feature (F-04) HTTP surface:
 *   POST   /api/v1/users/deletion-requests           (authenticated)
 *   DELETE /api/v1/users/deletion-requests           (authenticated)
 *   POST   /api/v1/users/deletion-requests/confirm   (authenticated — OTP-gated)
 *
 * Error mapping:
 *   AccountNotActiveException             → 403  AUTH_ACCOUNT_NOT_ACTIVE
 *   DeletionRequestAlreadyPendingException → 409  DELETION_REQUEST_ALREADY_PENDING
 *   DeletionRequestNotFoundException       → 404  DELETION_REQUEST_NOT_FOUND
 *   DeletionOtpExpiredException            → 410  DELETION_OTP_EXPIRED
 *   DeletionOtpInvalidException            → 422  DELETION_OTP_INVALID
 *   malformed body (confirm)                → 400
 *   unexpected                              → 500
 *
 * Requirements: US-022 FR-001–003, FR-007; US-023 FR-001, FR-004–007
 */

import { Request, Response } from 'express';
import { AccountDeletionService } from '../services/account-deletion.service';
import {
  AccountNotActiveException,
  DeletionRequestAlreadyPendingException,
  DeletionRequestNotFoundException,
  DeletionOtpExpiredException,
  DeletionOtpInvalidException,
} from '../errors/account-deletion.errors';

export class DeletionController {
  constructor(private readonly accountDeletionService: AccountDeletionService) {}

  /**
   * Handle POST /api/v1/users/deletion-requests
   * Requires SessionValidationMiddleware to have populated req.userId.
   */
  async requestDeletion(req: Request, res: Response): Promise<void> {
    const userId = req.userId as string;

    try {
      await this.accountDeletionService.requestDeletion(userId);
      res.status(202).json({
        message: 'A confirmation code has been sent to your email.',
      });
    } catch (err) {
      if (err instanceof AccountNotActiveException) {
        res.status(403).json({ error_code: 'AUTH_ACCOUNT_NOT_ACTIVE', message: err.message });
      } else if (err instanceof DeletionRequestAlreadyPendingException) {
        res.status(409).json({
          error_code: 'DELETION_REQUEST_ALREADY_PENDING',
          message: err.message,
        });
      } else {
        console.error('[DeletionController] Unexpected error during requestDeletion:', err);
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  /**
   * Handle DELETE /api/v1/users/deletion-requests
   * Requires SessionValidationMiddleware to have populated req.userId.
   */
  async cancelDeletion(req: Request, res: Response): Promise<void> {
    const userId = req.userId as string;

    try {
      await this.accountDeletionService.cancelDeletion(userId);
      res.status(200).json({ message: 'Your pending deletion request has been cancelled.' });
    } catch (err) {
      if (err instanceof DeletionRequestNotFoundException) {
        res.status(404).json({ error_code: 'DELETION_REQUEST_NOT_FOUND', message: err.message });
      } else {
        console.error('[DeletionController] Unexpected error during cancelDeletion:', err);
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }

  /**
   * Handle POST /api/v1/users/deletion-requests/confirm
   * Requires SessionValidationMiddleware to have populated req.userId — the
   * code is checked against the caller's own pending request.
   */
  async confirmDeletion(req: Request, res: Response): Promise<void> {
    const userId = req.userId as string;
    const code = req.body.code as string | undefined;

    if (!code || typeof code !== 'string' || code.trim() === '') {
      res.status(400).json({ error: 'code is required.' });
      return;
    }

    try {
      const result = await this.accountDeletionService.confirmDeletion(userId, code);
      res.status(200).json({
        userId: result.userId,
        deletedAt: result.deletedAt.toISOString(),
      });
    } catch (err) {
      if (err instanceof DeletionRequestNotFoundException) {
        res.status(404).json({ error_code: 'DELETION_REQUEST_NOT_FOUND', message: err.message });
      } else if (err instanceof DeletionOtpExpiredException) {
        res.status(410).json({ error_code: 'DELETION_OTP_EXPIRED', message: err.message });
      } else if (err instanceof DeletionOtpInvalidException) {
        res.status(422).json({ error_code: 'DELETION_OTP_INVALID', message: err.message });
      } else {
        console.error('[DeletionController] Unexpected error during confirmDeletion:', err);
        res.status(500).json({ error: 'An unexpected error occurred.' });
      }
    }
  }
}
