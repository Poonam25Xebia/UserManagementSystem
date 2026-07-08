/**
 * health.routes.ts
 *
 * Factory function that returns an Express Router with GET /health mounted.
 * Parent app mounts this at the root path (no authentication required).
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { HealthController } from '../controllers/health.controller';

export function createHealthRouter(pool: Pool): Router {
  const router = Router();

  const controller = new HealthController(pool);

  // GET /health
  router.get('/health', (req, res) => { void controller.check(req, res); });

  return router;
}
