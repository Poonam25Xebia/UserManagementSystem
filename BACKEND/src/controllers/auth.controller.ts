/**
 * auth.controller.ts
 *
 * Entry point for POST /api/v1/auth/login and POST /api/v1/auth/logout.
 *
 * Error mapping (login):
 *   InvalidCredentialsException    → 401  AUTH_INVALID_CREDENTIALS
 *   AccountNotActiveException      → 403  AUTH_ACCOUNT_NOT_ACTIVE
 *   AccountLockedException         → 423  AUTH_ACCOUNT_LOCKED { retry_after }
 *   SessionCreationFailedException → 500  SESSION_CREATION_FAILED
 *   malformed body                 → 400
 *   unexpected                     → 500
 *
 * Logout is intentionally idempotent at the HTTP layer: a missing/expired/
 * already-invalidated token still yields 200 (EC-005) — only a missing
 * Authorization header is rejected outright (401), since that is a caller
 * error rather than a session-state question.
 *
 * Requirements: US-036 FR-001, FR-005, FR-010; US-038 FR-005–006, EC-002, EC-004–EC-005
 */

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { LoginRequestDto } from '../types/login.types';
import {
  InvalidCredentialsException,
  AccountNotActiveException,
  AccountLockedException,
  SessionCreationFailedException,
} from '../errors/login.errors';

const BEARER_PREFIX = 'Bearer ';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Handle POST /api/v1/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    const email = req.body.email as string | undefined;
    const password = req.body.password as string | undefined;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      res.status(400).json({ error: 'email is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password === '') {
      res.status(400).json({ error: 'password is required.' });
      return;
    }

    const dto: LoginRequestDto = { email: email.trim(), password };

    try {
      const result = await this.authService.login(dto.email, dto.password);
      res.status(200).json({
        token: result.token,
        expires_at: result.expiresAt.toISOString(),
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsException) {
        res.status(401).json({
          error_code: 'AUTH_INVALID_CREDENTIALS',
          message: err.message,
        });
      } else if (err instanceof AccountNotActiveException) {
        res.status(403).json({
          error_code: 'AUTH_ACCOUNT_NOT_ACTIVE',
          message: err.message,
        });
      } else if (err instanceof AccountLockedException) {
        res.status(423).json({
          error_code: 'AUTH_ACCOUNT_LOCKED',
          message: err.message,
          retry_after: err.retryAfter.toISOString(),
        });
      } else if (err instanceof SessionCreationFailedException) {
        res.status(500).json({
          error_code: 'SESSION_CREATION_FAILED',
          message: err.message,
        });
      } else {
        console.error('[AuthController] Unexpected error during login:', err);
        res.status(500).json({ error: 'An unexpected error occurred during login.' });
      }
    }
  }

  /**
   * Handle POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    const rawAuthorization = req.header('authorization');

    if (!rawAuthorization || typeof rawAuthorization !== 'string') {
      res.status(401).json({ error: 'Authorization header is required.' });
      return;
    }

    if (!rawAuthorization.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ error: 'Authorization header must use Bearer scheme.' });
      return;
    }

    const rawToken = rawAuthorization.slice(BEARER_PREFIX.length).trim();
    if (!rawToken) {
      res.status(401).json({ error: 'Bearer token is required.' });
      return;
    }

    // Idempotent by design (EC-005) — the result of invalidateSession is not
    // branched on: whether the session was actively invalidated or was
    // already terminated, the client always receives the same confirmation.
    await this.sessionService.invalidateSession(rawToken);
    res.status(200).json({ message: 'Logged out.' });
  }
}
