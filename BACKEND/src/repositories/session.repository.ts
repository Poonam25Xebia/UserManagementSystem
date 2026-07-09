/**
 * session.repository.ts
 *
 * Repository for the `sessions` table.  All queries use parameterised `?`
 * placeholders — no string interpolation.
 *
 * Requirements: US-038 FR-001–002, FR-004–006, FR-008
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
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
// Row type returned by better-sqlite3
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  invalidated: number;
  invalidated_at: string | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: SessionRow): SessionEntity {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    invalidated: row.invalidated === 1,
    invalidatedAt: row.invalidated_at === null ? null : new Date(row.invalidated_at),
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SessionRepository implements ISessionRepository {
  constructor(private readonly db: Database) {}

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
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO sessions
          (id, user_id, token_hash, created_at, expires_at, invalidated, invalidated_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL)`,
      )
      .run(id, userId, tokenHash, createdAt.toISOString(), expiresAt.toISOString());

    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow;
    return rowToEntity(row);
  }

  /**
   * Look up a session by the SHA-256 hash of its raw token.
   * Returns null if no match is found.
   */
  async findByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE token_hash = ? LIMIT 1')
      .get(tokenHash) as SessionRow | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Mark a single session as invalidated (logout — FR-005, EC-002).
   */
  async markInvalidated(id: string, invalidatedAt: Date): Promise<void> {
    this.db
      .prepare('UPDATE sessions SET invalidated = 1, invalidated_at = ? WHERE id = ?')
      .run(invalidatedAt.toISOString(), id);
  }

  /**
   * Bulk-invalidate every still-active session belonging to a user.
   * Used on account suspension (EC-003) and password reset (FR-018).
   */
  async invalidateAllForUser(userId: string): Promise<void> {
    this.db
      .prepare(
        'UPDATE sessions SET invalidated = 1, invalidated_at = ? WHERE user_id = ? AND invalidated = 0',
      )
      .run(new Date().toISOString(), userId);
  }

  /**
   * Count the user's currently active sessions — not invalidated (logged out)
   * and not yet past expires_at.
   */
  async countActiveForUser(userId: string): Promise<number> {
    const row = this.db
      .prepare(
        'SELECT COUNT(*) AS count FROM sessions WHERE user_id = ? AND invalidated = 0 AND expires_at > ?',
      )
      .get(userId, new Date().toISOString()) as { count: number };

    return row.count;
  }
}
