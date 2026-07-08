/**
 * deletion-request.repository.ts
 *
 * Repository for the `account_deletion_requests` table.  All queries use
 * parameterised `pg` placeholders — no string interpolation.
 *
 * Requirements: US-023 FR-001–007; US-022 FR-007–008
 */

import { Pool, QueryResult } from 'pg';
import { DeletionRequestEntity } from '../types/account-deletion.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IDeletionRequestRepository {
  insert(
    userId: string,
    codeHash: string,
    issuedAt: Date,
    expiresAt: Date,
  ): Promise<DeletionRequestEntity>;
  findPendingByUserId(userId: string): Promise<DeletionRequestEntity | null>;
  updateStatus(
    id: string,
    status: 'confirmed' | 'cancelled',
    timestamp: Date,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row type returned by pg
// ---------------------------------------------------------------------------

interface DeletionRequestRow {
  id: string;
  user_id: string;
  code_hash: string;
  issued_at: Date;
  expires_at: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmed_at: Date | null;
  cancelled_at: Date | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: DeletionRequestRow): DeletionRequestEntity {
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: row.status,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DeletionRequestRepository implements IDeletionRequestRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new pending deletion request and return the persisted entity
   * (with generated id).
   */
  async insert(
    userId: string,
    codeHash: string,
    issuedAt: Date,
    expiresAt: Date,
  ): Promise<DeletionRequestEntity> {
    const sql = `
      INSERT INTO account_deletion_requests
        (user_id, code_hash, issued_at, expires_at, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `;

    const result: QueryResult<DeletionRequestRow> = await this.pool.query(sql, [
      userId,
      codeHash,
      issuedAt,
      expiresAt,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up the caller's own 'pending' deletion request, if any.
   * Returns null if none exists.
   */
  async findPendingByUserId(userId: string): Promise<DeletionRequestEntity | null> {
    const sql = `
      SELECT * FROM account_deletion_requests
      WHERE user_id = $1 AND status = 'pending'
      LIMIT 1
    `;

    const result: QueryResult<DeletionRequestRow> = await this.pool.query(sql, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Transition a request to 'confirmed' or 'cancelled', stamping the
   * corresponding timestamp column. One-way — callers only reach this once
   * a 'pending' check has already passed.
   */
  async updateStatus(
    id: string,
    status: 'confirmed' | 'cancelled',
    timestamp: Date,
  ): Promise<void> {
    const column = status === 'confirmed' ? 'confirmed_at' : 'cancelled_at';
    const sql = `
      UPDATE account_deletion_requests
      SET status = $1, ${column} = $2
      WHERE id = $3
    `;

    await this.pool.query(sql, [status, timestamp, id]);
  }
}
