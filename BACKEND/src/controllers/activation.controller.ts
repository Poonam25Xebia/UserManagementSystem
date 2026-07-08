/**
 * activation.controller.ts
 *
 * Entry point for POST /api/v1/users/activate.
 * No JWT required — the activation token is the credential.
 *
 * Request body: { token: string (non-empty, max 512 chars) }
 *
 * Error mapping:
 *   TokenNotFoundException      → 404  TOKEN_NOT_FOUND
 *   TokenExpiredException       → 410  TOKEN_EXPIRED
 *   TokenConsumedException      → 410  TOKEN_CONSUMED
 *   AccountNotPendingException  → 409  ACCOUNT_NOT_PENDING
 *   malformed body              → 400
 *   unexpected                  → 500
 *
 * Requirements: US-074 FR-001, FR-012
 */

import { Request, Response } from 'express';
import { ActivationService } from '../services/activation.service';
import {
  TokenNotFoundException,
  TokenExpiredException,
  TokenConsumedException,
  AccountNotPendingException,
} from '../errors/registration.errors';

const MAX_TOKEN_LENGTH = 512;

export class ActivationController {
  constructor(private readonly activationService: ActivationService) {}

  /**
   * Handle POST /api/v1/users/activate
   */
  async activateAccount(req: Request, res: Response): Promise<void> {
    const rawToken = req.body.token as string | undefined;

    // --- Input validation: token must be present and within length limit ---
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim() === '') {
      res.status(400).json({ error: 'Token is required.' });
      return;
    }

    if (rawToken.length > MAX_TOKEN_LENGTH) {
      res.status(400).json({ error: `Token must not exceed ${MAX_TOKEN_LENGTH} characters.` });
      return;
    }

    try {
      const result = await this.activationService.activate(rawToken.trim());
      res.status(200).json({
        message: 'Account successfully activated.',
        userId: result.userId,
      });
    } catch (err) {
      if (err instanceof TokenNotFoundException) {
        res.status(404).json({
          errorCode: 'TOKEN_NOT_FOUND',
          message: err.message,
        });
      } else if (err instanceof TokenExpiredException) {
        res.status(410).json({
          errorCode: 'TOKEN_EXPIRED',
          message: err.message,
        });
      } else if (err instanceof TokenConsumedException) {
        res.status(410).json({
          errorCode: 'TOKEN_CONSUMED',
          message: err.message,
        });
      } else if (err instanceof AccountNotPendingException) {
        res.status(409).json({
          errorCode: 'ACCOUNT_NOT_PENDING',
          message: err.message,
        });
      } else {
        console.error('[ActivationController] Unexpected error:', err);
        res.status(500).json({ error: 'An unexpected error occurred during activation.' });
      }
    }
  }
}
