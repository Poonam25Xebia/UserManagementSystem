/**
 * user-profile.routes.ts
 *
 * Factory function that wires UserProfileService dependencies and returns an
 * Express Router with:
 *   GET /me   (behind SessionValidationMiddleware)
 * Parent app mounts this at /api/v1/users.
 *
 * sessionService is accepted as a parameter for the same reason
 * deletion.routes.ts accepts it — callers supply the same instance used
 * elsewhere in the app, matching SessionValidationMiddleware's role as a
 * cross-cutting guard (US-038 A-003).
 */

import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { DefaultUserProfileService } from '../services/user-profile.service';
import { UserProfileController } from '../controllers/user-profile.controller';
import { SessionService } from '../services/session.service';
import { createSessionValidationMiddleware } from '../middleware/session-validation.middleware';

export function createUserProfileRouter(db: Database, sessionService: SessionService): Router {
  const router = Router();

  const controller = new UserProfileController(
    new DefaultUserProfileService(new UserRepository(db), new SessionRepository(db)),
  );

  const requireSession = createSessionValidationMiddleware(sessionService);

  // GET /api/v1/users/me
  router.get('/me', requireSession, (req, res) => {
    void controller.getMe(req, res);
  });

  return router;
}
