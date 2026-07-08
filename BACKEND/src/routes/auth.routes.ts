/**
 * auth.routes.ts
 *
 * Factory function that wires AuthService/SessionService dependencies and
 * returns an Express Router with POST /login and POST /logout mounted.
 * Parent app mounts this at /api/v1/auth.
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { BcryptPasswordHasher } from '../services/password-hasher';
import { DefaultLoginGuard } from '../services/login-guard';
import { DefaultSessionService } from '../services/session.service';
import { DefaultAuthService } from '../services/auth.service';
import { AuthController } from '../controllers/auth.controller';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  const userRepository = new UserRepository(pool);
  const sessionRepository = new SessionRepository(pool);
  const sessionService = new DefaultSessionService(sessionRepository, userRepository);
  const authService = new DefaultAuthService(
    userRepository,
    new BcryptPasswordHasher(),
    new DefaultLoginGuard(userRepository),
    sessionService,
  );
  const controller = new AuthController(authService, sessionService);

  // POST /api/v1/auth/login
  router.post('/login', (req, res) => { void controller.login(req, res); });

  // POST /api/v1/auth/logout
  router.post('/logout', (req, res) => { void controller.logout(req, res); });

  return router;
}
