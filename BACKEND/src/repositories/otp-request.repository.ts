/**
 * otp-request.repository.ts
 *
 * Repository for the `otp_requests` table.  All queries use parameterised
 * `pg` placeholders — no string interpolation.
 *
 * Requirements: US-002 FR-003, FR-006, FR-009
 */

import { Pool, QueryResult } from 'pg';
import { OtpRequestEntity } from '../types/otp.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IOtpRequestRepository {
  create(record: Omit<OtpRequestEntity, 'id'>): Promise<OtpRequestEntity>;
  findActiveByUserId(userId: string): Promise<OtpRequestEntity | null>;
  invalidateActiveByUserId(userId: string): Promise<void>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  findById(id: string): Promise<OtpRequestEntity | null>;
  getNextAttemptSequence(userId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Row type returned by pg
// ---------------------------------------------------------------------------

interface OtpRequestRow {
  id: string;
  user_id: string;
  email_address: string;
  code_hash: string;
  status: 'pending' | 'delivered' | 'failed';
  created_at: Date;
  expires_at: Date;
  invalidated_at: Date | null;
  attempt_sequence: number;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: OtpRequestRow): OtpRequestEntity {
  return {
    id: row.id,
    userId: row.user_id,
    emailAddress: row.email_address,
    codeHash: row.code_hash,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    invalidatedAt: row.invalidated_at,
    attemptSequence: row.attempt_sequence,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class OtpRequestRepository implements IOtpRequestRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new OTP request row and return the persisted entity (with
   * generated id).
   */
  async create(record: Omit<OtpRequestEntity, 'id'>): Promise<OtpRequestEntity> {
    const sql = `
      INSERT INTO otp_requests
        (user_id, email_address, code_hash, status, created_at, expires_at,
         invalidated_at, attempt_sequence)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result: QueryResult<OtpRequestRow> = await this.pool.query(sql, [
      record.userId,
      record.emailAddress,
      record.codeHash,
      record.status,
      record.createdAt,
      record.expiresAt,
      record.invalidatedAt,
      record.attemptSequence,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up the current active (non-invalidated) OTP request for a user.
   * Returns null if there is none (partial unique index enforces at most one).
   */
  async findActiveByUserId(userId: string): Promise<OtpRequestEntity | null> {
    const sql = `
      SELECT * FROM otp_requests
      WHERE user_id = $1 AND invalidated_at IS NULL
      LIMIT 1
    `;

    const result: QueryResult<OtpRequestRow> = await this.pool.query(sql, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Mark any currently active OTP request(s) for a user as invalidated.
   */
  async invalidateActiveByUserId(userId: string): Promise<void> {
    const sql = `
      UPDATE otp_requests
      SET invalidated_at = NOW()
      WHERE user_id = $1 AND invalidated_at IS NULL
    `;

    await this.pool.query(sql, [userId]);
  }

  /**
   * Mark an OTP request as successfully delivered.
   */
  async markDelivered(id: string): Promise<void> {
    const sql = `
      UPDATE otp_requests
      SET status = 'delivered'
      WHERE id = $1
    `;

    await this.pool.query(sql, [id]);
  }

  /**
   * Mark an OTP request as failed to deliver.
   */
  async markFailed(id: string): Promise<void> {
    const sql = `
      UPDATE otp_requests
      SET status = 'failed'
      WHERE id = $1
    `;

    await this.pool.query(sql, [id]);
  }

  /**
   * Look up an OTP request by its primary key UUID.
   * Returns null if no match is found.
   */
  async findById(id: string): Promise<OtpRequestEntity | null> {
    const sql = `
      SELECT * FROM otp_requests
      WHERE id = $1
      LIMIT 1
    `;

    const result: QueryResult<OtpRequestRow> = await this.pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Compute the next monotonically increasing attempt_sequence value for a
   * user, based on how many OTP requests have previously been issued to them.
   */
  async getNextAttemptSequence(userId: string): Promise<number> {
    const sql = `
      SELECT COALESCE(MAX(attempt_sequence), 0) + 1 AS next_sequence
      FROM otp_requests
      WHERE user_id = $1
    `;

    const result: QueryResult<{ next_sequence: number }> = await this.pool.query(sql, [userId]);

    return result.rows[0].next_sequence;
  }
}
