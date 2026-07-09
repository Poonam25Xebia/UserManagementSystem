/**
 * password.routes.ts
 *
 * Factory function that wires PasswordRecoveryService dependencies and
 * returns an Express Router with POST /password-recovery and
 * POST /password-reset mounted.
 * Parent app mounts this at /api/v1/auth.
 *
 * notificationPort is accepted as a parameter (rather than constructed
 * internally) for the same reason otp.routes.ts accepts otpDeliveryPort:
 * PasswordRecoveryService dispatches synchronously within the request
 * (unlike Registration's async outbox worker, which never runs in tests),
 * so tests must be able to inject a no-op/fake port instead of hitting a
 * real email provider on every password-recovery call.
 */

import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { UserRepository } from '../repositories/user.repository';
import { PasswordRecoveryRequestRepository } from '../repositories/password-recovery-request.repository';
import { DefaultPasswordPolicyEvaluator } from '../validators/password-policy.evaluator';
import { BcryptPasswordHasher } from '../services/password-hasher';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DefaultPasswordRecoveryService } from '../services/password-recovery.service';
import { PasswordController } from '../controllers/password.controller';

export function createPasswordRouter(db: Database, notificationPort: EmailDeliveryPort): Router {
  const router = Router();

  const controller = new PasswordController(
    new DefaultPasswordRecoveryService(
      new UserRepository(db),
      new PasswordRecoveryRequestRepository(db),
      new DefaultPasswordPolicyEvaluator(),
      new BcryptPasswordHasher(),
      notificationPort,
      db,
    ),
  );

  // POST /api/v1/auth/password-recovery
  router.post('/password-recovery', (req, res) => { void controller.requestRecovery(req, res); });

  // POST /api/v1/auth/password-reset
  router.post('/password-reset', (req, res) => { void controller.resetPassword(req, res); });

  return router;
}
