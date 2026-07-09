import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { UserRepository } from '../repositories/user.repository';
import { TokenRepository } from '../repositories/token.repository';
import { EmailRecordRepository } from '../repositories/email-record.repository';
import { DefaultEmailDispatchService } from '../services/email-dispatch.service';
import { AdminController } from '../controllers/admin.controller';
import { requireAdminBearerToken } from '../middleware/admin-auth.middleware';

export function createAdminRouter(db: Database): Router {
  const router = Router();

  const userRepo = new UserRepository(db);
  const tokenRepo = new TokenRepository(db);
  const emailRecordRepo = new EmailRecordRepository(db);
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
