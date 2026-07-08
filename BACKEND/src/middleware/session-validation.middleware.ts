/**
 * session-validation.middleware.ts
 *
 * Cross-cutting Express middleware that guards protected routes across the
 * whole service, not just this feature's own controllers (US-038 A-003).
 *
 * Requirements: US-038 A-003, FR-004, FR-006
 */

import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/session.service';

const BEARER_PREFIX = 'Bearer ';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Build the session-validation middleware for a given SessionService
 * instance. Attach the returned function to any route (or router-level
 * `use()`) that requires an authenticated session.
 *
 * On success: `req.userId` is populated and `next()` is called.
 * On failure: the response is sent directly and `next()` is NOT called.
 */
export function createSessionValidationMiddleware(sessionService: SessionService) {
  return async function sessionValidationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const rawAuthorization = req.header('authorization');

    if (!rawAuthorization || typeof rawAuthorization !== 'string') {
      res.status(401).json({ error_code: 'AUTH_HEADER_MISSING', message: 'Authorization header is required.' });
      return;
    }

    if (!rawAuthorization.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ error_code: 'AUTH_HEADER_MALFORMED', message: 'Authorization header must use Bearer scheme.' });
      return;
    }

    const rawToken = rawAuthorization.slice(BEARER_PREFIX.length).trim();
    if (!rawToken) {
      res.status(401).json({ error_code: 'AUTH_HEADER_MALFORMED', message: 'Bearer token is required.' });
      return;
    }

    const result = await sessionService.validateSession(rawToken);

    if (!result.valid) {
      switch (result.reason) {
        case 'NOT_FOUND':
          res.status(401).json({ error_code: 'SESSION_NOT_FOUND', message: 'No matching session was found for the provided token.' });
          return;
        case 'EXPIRED':
          res.status(401).json({ error_code: 'SESSION_EXPIRED', message: 'The session has expired. Please log in again.' });
          return;
        case 'INVALIDATED':
          res.status(401).json({ error_code: 'SESSION_INVALIDATED', message: 'The session has been invalidated. Please log in again.' });
          return;
        case 'ACCOUNT_SUSPENDED':
          res.status(403).json({ error_code: 'AUTH_ACCOUNT_NOT_ACTIVE', message: 'This account is not active.' });
          return;
      }
    }

    req.userId = result.userId;
    next();
  };
}
