/**
 * health.controller.ts
 *
 * Entry point for GET /health. Used by the API Gateway for upstream health
 * probing — no authentication required.
 *
 * Always returns 200, even when the database is unreachable: `db_reachable`
 * reports the DB's status without turning a downstream outage into a health
 * check failure at this layer.
 *
 * Requirements: US-036 FR-020; US-039 FR-018
 */

import { Request, Response } from 'express';
import type { Database } from 'better-sqlite3';

export class HealthController {
  constructor(private readonly db: Database) {}

  /**
   * Handle GET /health
   */
  async check(_req: Request, res: Response): Promise<void> {
    let dbReachable: boolean;

    try {
      this.db.prepare('SELECT 1').get();
      dbReachable = true;
    } catch (err) {
      console.error('[HealthController] Database health check failed:', err);
      dbReachable = false;
    }

    res.status(200).json({ status: 'ok', db_reachable: dbReachable });
  }
}
