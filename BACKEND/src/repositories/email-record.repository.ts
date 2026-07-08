/**
 * email-record.repository.ts
 *
 * Repository for the `registration_email_records` table (transactional outbox).
 * All queries use parameterised `pg` placeholders — no string interpolation.
 *
 * Requirements: US-073 FR-007–009
 */

import { Pool, QueryResult } from 'pg';
import { RegistrationEmailRecord } from '../types/registration.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IEmailRecordRepository {
  insert(
    record: Omit<RegistrationEmailRecord, 'recordId'>,
  ): Promise<RegistrationEmailRecord>;
  findByStatus(
    status: 'queued' | 'sent' | 'failed',
  ): Promise<RegistrationEmailRecord[]>;
  findByUserId(userId: string): Promise<RegistrationEmailRecord | null>;
  updateStatus(
    recordId: string,
    status: 'queued' | 'sent' | 'failed',
  ): Promise<void>;
  incrementRetryCount(recordId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row type returned by pg
// ---------------------------------------------------------------------------

interface EmailRecordRow {
  record_id: string;
  user_id: string;
  recipient_address: string;
  dispatch_timestamp: Date;
  delivery_status: 'queued' | 'sent' | 'failed';
  retry_count: number;
  activation_token_id: string;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: EmailRecordRow): RegistrationEmailRecord {
  return {
    recordId: row.record_id,
    userId: row.user_id,
    recipientAddress: row.recipient_address,
    dispatchTimestamp: row.dispatch_timestamp,
    deliveryStatus: row.delivery_status,
    retryCount: row.retry_count,
    activationTokenId: row.activation_token_id,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class EmailRecordRepository implements IEmailRecordRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new outbox record and return the persisted entity (with
   * generated record_id).
   */
  async insert(
    record: Omit<RegistrationEmailRecord, 'recordId'>,
  ): Promise<RegistrationEmailRecord> {
    const sql = `
      INSERT INTO registration_email_records
        (user_id, recipient_address, dispatch_timestamp, delivery_status,
         retry_count, activation_token_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result: QueryResult<EmailRecordRow> = await this.pool.query(sql, [
      record.userId,
      record.recipientAddress,
      record.dispatchTimestamp,
      record.deliveryStatus,
      record.retryCount,
      record.activationTokenId,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Return all outbox records matching the given delivery status, ordered by
   * dispatch_timestamp ascending (oldest first — FIFO dispatch order).
   */
  async findByStatus(
    status: 'queued' | 'sent' | 'failed',
  ): Promise<RegistrationEmailRecord[]> {
    const sql = `
      SELECT * FROM registration_email_records
      WHERE delivery_status = $1
      ORDER BY dispatch_timestamp ASC
    `;

    const result: QueryResult<EmailRecordRow> = await this.pool.query(sql, [status]);

    return result.rows.map(rowToEntity);
  }

  /**
   * Look up a single outbox record by the owning user's UUID.
   * Returns null if not found (UNIQUE constraint enforces one per user).
   */
  async findByUserId(userId: string): Promise<RegistrationEmailRecord | null> {
    const sql = `
      SELECT * FROM registration_email_records
      WHERE user_id = $1
      LIMIT 1
    `;

    const result: QueryResult<EmailRecordRow> = await this.pool.query(sql, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Update the delivery_status of the record identified by record_id.
   */
  async updateStatus(
    recordId: string,
    status: 'queued' | 'sent' | 'failed',
  ): Promise<void> {
    const sql = `
      UPDATE registration_email_records
      SET delivery_status = $1
      WHERE record_id = $2
    `;

    await this.pool.query(sql, [status, recordId]);
  }

  /**
   * Atomically increment retry_count by 1 for the record identified by
   * record_id.
   */
  async incrementRetryCount(recordId: string): Promise<void> {
    const sql = `
      UPDATE registration_email_records
      SET retry_count = retry_count + 1
      WHERE record_id = $1
    `;

    await this.pool.query(sql, [recordId]);
  }
}
