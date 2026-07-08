/**
 * activation.routes.ts
 *
 * Factory function that wires ActivationService dependencies and returns an
 * Express Router with POST /activate mounted.
 * Parent app mounts this at /api/v1/users.
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { TokenRepository } from '../repositories/token.repository';
import { UserRepository } from '../repositories/user.repository';
import { DefaultActivationService } from '../services/activation.service';
import { ActivationController } from '../controllers/activation.controller';

export function createActivationRouter(pool: Pool): Router {
  const router = Router();

  const controller = new ActivationController(
    new DefaultActivationService(
      new TokenRepository(pool),
      new UserRepository(pool),
      pool,
    ),
  );

  // POST /api/v1/users/activate
  router.post('/activate', (req, res) => { void controller.activateAccount(req, res); });

  return router;
}
