/**
 * otp.routes.ts
 *
 * Factory function that wires OtpService dependencies and returns an Express
 * Router with POST /send and POST /resend mounted.
 * Parent app mounts this at /api/v1/otp.
 *
 * The Redis client and OtpDeliveryPort are accepted as parameters (rather
 * than constructed internally, as `pool`-only repositories are) because they
 * are shared external clients owned by server.ts's top-level wiring — the
 * same reason SendGridEmailAdapter is built once in server.ts rather than
 * per-router. See task 5 for the concrete OtpDeliveryPort implementation and
 * task 7 for full app wiring.
 */

import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { Redis } from 'ioredis';
import { UserRepository } from '../repositories/user.repository';
import { OtpRequestRepository } from '../repositories/otp-request.repository';
import { RedisRateLimitGuard } from '../services/rate-limit.guard';
import { DefaultOtpService } from '../services/otp.service';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import { OtpController } from '../controllers/otp.controller';

export function createOtpRouter(db: Database, redis: Redis, otpDeliveryPort: OtpDeliveryPort): Router {
  const router = Router();

  const controller = new OtpController(
    new DefaultOtpService(
      new UserRepository(db),
      new OtpRequestRepository(db),
      new RedisRateLimitGuard(redis),
      otpDeliveryPort,
      db,
    ),
  );

  // POST /api/v1/otp/send
  router.post('/send', (req, res) => { void controller.sendOtp(req, res); });

  // POST /api/v1/otp/resend
  router.post('/resend', (req, res) => { void controller.resendOtp(req, res); });

  // POST /api/v1/otp/verify
  router.post('/verify', (req, res) => { void controller.verifyOtp(req, res); });

  return router;
}
