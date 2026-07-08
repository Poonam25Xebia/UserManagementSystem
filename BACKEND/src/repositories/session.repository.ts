/**
 * session.repository.ts
 *
 * Repository for the `sessions` table.  All queries use parameterised `pg`
 * placeholders — no string interpolation.
 *
 * Requirements: US-038 FR-001–002, FR-004–006, FR-008
 */

import { Pool, QueryResult } from 'pg';
import { SessionEntity } from '../types/login.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ISessionRepository {
  insert(
    userId: string,
    tokenHash: string,
    createdAt: Date,
    expiresAt: Date,
  ): Promise<SessionEntity>;
  findByTokenHash(tokenHash: string): Promise<SessionEntity | null>;
  markInvalidated(id: string, invalidatedAt: Date): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
  countActiveForUser(userId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Row type returned by pg
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  invalidated: boolean;
  invalidated_at: Date | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: SessionRow): SessionEntity {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    invalidated: row.invalidated,
    invalidatedAt: row.invalidated_at,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SessionRepository implements ISessionRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new session row and return the persisted entity (with generated
   * id). Only the token hash is ever written — the raw token is never passed
   * to this repository.
   */
  async insert(
    userId: string,
    tokenHash: string,
    createdAt: Date,
    expiresAt: Date,
  ): Promise<SessionEntity> {
    const sql = `
      INSERT INTO sessions
        (user_id, token_hash, created_at, expires_at, invalidated, invalidated_at)
      VALUES ($1, $2, $3, $4, FALSE, NULL)
      RETURNING *
    `;

    const result: QueryResult<SessionRow> = await this.pool.query(sql, [
      userId,
      tokenHash,
      createdAt,
      expiresAt,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up a session by the SHA-256 hash of its raw token.
   * Returns null if no match is found.
   */
  async findByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    const sql = `
      SELECT * FROM sessions
      WHERE token_hash = $1
      LIMIT 1
    `;

    const result: QueryResult<SessionRow> = await this.pool.query(sql, [tokenHash]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Mark a single session as invalidated (logout — FR-005, EC-002).
   */
  async markInvalidated(id: string, invalidatedAt: Date): Promise<void> {
    const sql = `
      UPDATE sessions
      SET invalidated = TRUE, invalidated_at = $1
      WHERE id = $2
    `;

    await this.pool.query(sql, [invalidatedAt, id]);
  }

  /**
   * Bulk-invalidate every still-active session belonging to a user.
   * Used on account suspension (EC-003) and password reset (FR-018).
   */
  async invalidateAllForUser(userId: string): Promise<void> {
    const sql = `
      UPDATE sessions
      SET invalidated = TRUE, invalidated_at = NOW()
      WHERE user_id = $1 AND invalidated = FALSE
    `;

    await this.pool.query(sql, [userId]);
  }

  /**
   * Count the user's currently active sessions — not invalidated (logged out)
   * and not yet past expires_at.
   */
  async countActiveForUser(userId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS count FROM sessions
      WHERE user_id = $1 AND invalidated = FALSE AND expires_at > NOW()
    `;

    const result: QueryResult<{ count: string }> = await this.pool.query(sql, [userId]);

    return parseInt(result.rows[0].count, 10);
  }
}
