/**
 * registration.routes.ts
 *
 * Factory function that wires all dependencies and returns an Express Router
 * mounted at POST / (parent app mounts this at /api/v1/users).
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { DefaultRegistrationValidator } from '../validators/registration.validator';
import { DefaultEmailValidator } from '../validators/email.validator';
import { DefaultPasswordPolicyEvaluator } from '../validators/password-policy.evaluator';
import { DefaultUsernameUniquenessValidator } from '../validators/username-uniqueness.validator';
import { UserRepository } from '../repositories/user.repository';
import { OtpRequestRepository } from '../repositories/otp-request.repository';
import { DefaultRegistrationService } from '../services/registration.service';
import { DefaultOtpService } from '../services/otp.service';
import { RedisRateLimitGuard } from '../services/rate-limit.guard';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import { RegistrationController } from '../controllers/registration.controller';

/**
 * Create and return the registration router.
 * @param pool - Shared pg connection pool injected from app.ts / server.ts.
 * @param redis - Shared Redis client (OTP rate-limit guard), owned by server.ts.
 * @param otpDeliveryPort - Shared OTP email delivery adapter, owned by server.ts.
 */
export function createRegistrationRouter(
  pool: Pool,
  redis: Redis,
  otpDeliveryPort: OtpDeliveryPort,
): Router {
  const router = Router();

  const userRepo = new UserRepository(pool);
  const otpService = new DefaultOtpService(
    userRepo,
    new OtpRequestRepository(pool),
    new RedisRateLimitGuard(redis),
    otpDeliveryPort,
    pool,
  );
  const controller = new RegistrationController(
    new DefaultRegistrationValidator(),
    new DefaultEmailValidator(),
    new DefaultPasswordPolicyEvaluator(),
    new DefaultUsernameUniquenessValidator(userRepo),
    new DefaultRegistrationService(pool),
    otpService,
  );

  // POST /api/v1/users/register  (parent mounts at /api/v1/users)
  router.post('/register', (req, res) => { void controller.registerUser(req, res); });

  return router;
}
