/**
 * deletion-request.repository.ts
 *
 * Repository for the `account_deletion_requests` table.  All queries use
 * parameterised `?` placeholders — no string interpolation.
 *
 * Requirements: US-023 FR-001–007; US-022 FR-007–008
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
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
// Row type returned by better-sqlite3
// ---------------------------------------------------------------------------

interface DeletionRequestRow {
  id: string;
  user_id: string;
  code_hash: string;
  issued_at: string;
  expires_at: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmed_at: string | null;
  cancelled_at: string | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: DeletionRequestRow): DeletionRequestEntity {
  return {
    id: row.id,
    userId: row.user_id,
    codeHash: row.code_hash,
    issuedAt: new Date(row.issued_at),
    expiresAt: new Date(row.expires_at),
    status: row.status,
    confirmedAt: row.confirmed_at === null ? null : new Date(row.confirmed_at),
    cancelledAt: row.cancelled_at === null ? null : new Date(row.cancelled_at),
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DeletionRequestRepository implements IDeletionRequestRepository {
  constructor(private readonly db: Database) {}

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
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO account_deletion_requests
          (id, user_id, code_hash, issued_at, expires_at, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
      )
      .run(id, userId, codeHash, issuedAt.toISOString(), expiresAt.toISOString());

    const row = this.db
      .prepare('SELECT * FROM account_deletion_requests WHERE id = ?')
      .get(id) as DeletionRequestRow;
    return rowToEntity(row);
  }

  /**
   * Look up the caller's own 'pending' deletion request, if any.
   * Returns null if none exists.
   */
  async findPendingByUserId(userId: string): Promise<DeletionRequestEntity | null> {
    const row = this.db
      .prepare(
        "SELECT * FROM account_deletion_requests WHERE user_id = ? AND status = 'pending' LIMIT 1",
      )
      .get(userId) as DeletionRequestRow | undefined;

    return row === undefined ? null : rowToEntity(row);
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
    this.db
      .prepare(`UPDATE account_deletion_requests SET status = ?, ${column} = ? WHERE id = ?`)
      .run(status, timestamp.toISOString(), id);
  }
}
