/**
 * deletion.routes.ts
 *
 * Factory function that wires AccountDeletionService dependencies and
 * returns an Express Router with:
 *   POST   /deletion-requests           (behind SessionValidationMiddleware)
 *   DELETE /deletion-requests           (behind SessionValidationMiddleware)
 *   POST   /deletion-requests/confirm   (behind SessionValidationMiddleware — OTP-gated)
 * Parent app mounts this at /api/v1/users.
 *
 * sessionService is accepted as a parameter (rather than constructed
 * internally) so the caller supplies the same instance used elsewhere in the
 * app — matching how SessionValidationMiddleware is meant to be reused as a
 * cross-cutting guard (US-038 A-003) rather than re-instantiated per route.
 *
 * emailDeliveryPort is accepted as a parameter for the same reason
 * password.routes.ts accepts notificationPort: AccountDeletionService
 * dispatches the confirmation email synchronously within the request, so
 * tests must be able to inject a no-op/fake port instead of hitting a real
 * email provider on every deletion-request call.
 */

import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { UserRepository } from '../repositories/user.repository';
import { DeletionRequestRepository } from '../repositories/deletion-request.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DefaultAccountDeletionService } from '../services/account-deletion.service';
import { DeletionController } from '../controllers/deletion.controller';
import { SessionService } from '../services/session.service';
import { createSessionValidationMiddleware } from '../middleware/session-validation.middleware';

export function createDeletionRouter(
  db: Database,
  sessionService: SessionService,
  emailDeliveryPort: EmailDeliveryPort,
): Router {
  const router = Router();

  const controller = new DeletionController(
    new DefaultAccountDeletionService(
      new UserRepository(db),
      new DeletionRequestRepository(db),
      emailDeliveryPort,
      db,
    ),
  );

  const requireSession = createSessionValidationMiddleware(sessionService);

  // POST /api/v1/users/deletion-requests
  router.post('/deletion-requests', requireSession, (req, res) => {
    void controller.requestDeletion(req, res);
  });

  // DELETE /api/v1/users/deletion-requests
  router.delete('/deletion-requests', requireSession, (req, res) => {
    void controller.cancelDeletion(req, res);
  });

  // POST /api/v1/users/deletion-requests/confirm — authenticated, OTP-gated
  router.post('/deletion-requests/confirm', requireSession, (req, res) => {
    void controller.confirmDeletion(req, res);
  });

  return router;
}
