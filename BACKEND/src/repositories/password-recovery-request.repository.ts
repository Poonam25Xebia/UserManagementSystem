/**
 * password-recovery-request.repository.ts
 *
 * Repository for the `password_recovery_requests` table.  All queries use
 * parameterised `?` placeholders — no string interpolation.
 *
 * Requirements: US-036 FR-012, FR-015–016
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { PasswordRecoveryRequestEntity } from '../types/login.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IPasswordRecoveryRequestRepository {
  insert(
    userId: string,
    token: string,
    requestedAt: Date,
    expiresAt: Date,
  ): Promise<PasswordRecoveryRequestEntity>;
  findByToken(token: string): Promise<PasswordRecoveryRequestEntity | null>;
  markConsumed(id: string, consumedAt: Date): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row type returned by better-sqlite3
// ---------------------------------------------------------------------------

interface PasswordRecoveryRequestRow {
  id: string;
  user_id: string;
  token: string;
  requested_at: string;
  expires_at: string;
  consumed: number;
  consumed_at: string | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: PasswordRecoveryRequestRow): PasswordRecoveryRequestEntity {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    requestedAt: new Date(row.requested_at),
    expiresAt: new Date(row.expires_at),
    consumed: row.consumed === 1,
    consumedAt: row.consumed_at === null ? null : new Date(row.consumed_at),
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PasswordRecoveryRequestRepository
  implements IPasswordRecoveryRequestRepository
{
  constructor(private readonly db: Database) {}

  /**
   * Insert a new password-recovery request and return the persisted entity
   * (with generated id).
   */
  async insert(
    userId: string,
    token: string,
    requestedAt: Date,
    expiresAt: Date,
  ): Promise<PasswordRecoveryRequestEntity> {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO password_recovery_requests
          (id, user_id, token, requested_at, expires_at, consumed, consumed_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL)`,
      )
      .run(id, userId, token, requestedAt.toISOString(), expiresAt.toISOString());

    const row = this.db
      .prepare('SELECT * FROM password_recovery_requests WHERE id = ?')
      .get(id) as PasswordRecoveryRequestRow;
    return rowToEntity(row);
  }

  /**
   * Look up a recovery request by its opaque token string.
   * Returns null if no match is found.
   */
  async findByToken(token: string): Promise<PasswordRecoveryRequestEntity | null> {
    const row = this.db
      .prepare('SELECT * FROM password_recovery_requests WHERE token = ? LIMIT 1')
      .get(token) as PasswordRecoveryRequestRow | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Mark a recovery request as consumed after a successful password reset.
   */
  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    this.db
      .prepare('UPDATE password_recovery_requests SET consumed = 1, consumed_at = ? WHERE id = ?')
      .run(consumedAt.toISOString(), id);
  }
}
