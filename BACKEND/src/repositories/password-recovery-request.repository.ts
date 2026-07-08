/**
 * password-recovery-request.repository.ts
 *
 * Repository for the `password_recovery_requests` table.  All queries use
 * parameterised `pg` placeholders — no string interpolation.
 *
 * Requirements: US-036 FR-012, FR-015–016
 */

import { Pool, QueryResult } from 'pg';
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
// Row type returned by pg
// ---------------------------------------------------------------------------

interface PasswordRecoveryRequestRow {
  id: string;
  user_id: string;
  token: string;
  requested_at: Date;
  expires_at: Date;
  consumed: boolean;
  consumed_at: Date | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: PasswordRecoveryRequestRow): PasswordRecoveryRequestEntity {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    consumed: row.consumed,
    consumedAt: row.consumed_at,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PasswordRecoveryRequestRepository
  implements IPasswordRecoveryRequestRepository
{
  constructor(private readonly pool: Pool) {}

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
    const sql = `
      INSERT INTO password_recovery_requests
        (user_id, token, requested_at, expires_at, consumed, consumed_at)
      VALUES ($1, $2, $3, $4, FALSE, NULL)
      RETURNING *
    `;

    const result: QueryResult<PasswordRecoveryRequestRow> = await this.pool.query(sql, [
      userId,
      token,
      requestedAt,
      expiresAt,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up a recovery request by its opaque token string.
   * Returns null if no match is found.
   */
  async findByToken(token: string): Promise<PasswordRecoveryRequestEntity | null> {
    const sql = `
      SELECT * FROM password_recovery_requests
      WHERE token = $1
      LIMIT 1
    `;

    const result: QueryResult<PasswordRecoveryRequestRow> = await this.pool.query(sql, [
      token,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Mark a recovery request as consumed after a successful password reset.
   */
  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    const sql = `
      UPDATE password_recovery_requests
      SET consumed = TRUE, consumed_at = $1
      WHERE id = $2
    `;

    await this.pool.query(sql, [consumedAt, id]);
  }
}
