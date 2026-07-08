import { Router } from 'express';
import { Pool } from 'pg';
import { UserRepository } from '../repositories/user.repository';
import { TokenRepository } from '../repositories/token.repository';
import { EmailRecordRepository } from '../repositories/email-record.repository';
import { DefaultEmailDispatchService } from '../services/email-dispatch.service';
import { AdminController } from '../controllers/admin.controller';
import { requireAdminBearerToken } from '../middleware/admin-auth.middleware';

export function createAdminRouter(pool: Pool): Router {
  const router = Router();

  const userRepo = new UserRepository(pool);
  const tokenRepo = new TokenRepository(pool);
  const emailRecordRepo = new EmailRecordRepository(pool);
  const controller = new AdminController(
    new DefaultEmailDispatchService(userRepo, emailRecordRepo, tokenRepo),
  );

  router.post(
    '/users/:user_id/resend-confirmation',
    requireAdminBearerToken,
    (req, res) => { void controller.resendConfirmation(req, res); },
  );

  return router;
}
