/**
 * deletion-notification-record.repository.ts
 *
 * Repository for the `account_deletion_notification_records` table
 * (transactional outbox). All queries use parameterised `pg` placeholders —
 * no string interpolation.
 *
 * Same shape as EmailRecordRepository (F-01) — mirrors its method
 * signatures so AccountDeletionNotificationWorker can be structurally
 * identical to OutboxWorker.
 *
 * Requirements: US-033 FR-005–006
 */

import { Pool, QueryResult } from 'pg';
import { DeletionNotificationRecord } from '../types/account-deletion.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IDeletionNotificationRecordRepository {
  insert(
    userId: string,
    recipientAddress: string,
    deletionDate: Date,
  ): Promise<DeletionNotificationRecord>;
  findByStatus(
    status: 'queued' | 'sent' | 'failed',
  ): Promise<DeletionNotificationRecord[]>;
  updateStatus(
    recordId: string,
    status: 'sent' | 'failed',
  ): Promise<void>;
  incrementRetryCount(recordId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row type returned by pg
// ---------------------------------------------------------------------------

interface DeletionNotificationRecordRow {
  record_id: string;
  user_id: string;
  recipient_address: string;
  deletion_date: Date;
  dispatch_timestamp: Date;
  delivery_status: 'queued' | 'sent' | 'failed';
  retry_count: number;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: DeletionNotificationRecordRow): DeletionNotificationRecord {
  return {
    recordId: row.record_id,
    userId: row.user_id,
    recipientAddress: row.recipient_address,
    deletionDate: row.deletion_date,
    dispatchTimestamp: row.dispatch_timestamp,
    deliveryStatus: row.delivery_status,
    retryCount: row.retry_count,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DeletionNotificationRecordRepository
  implements IDeletionNotificationRecordRepository
{
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new outbox record and return the persisted entity (with
   * generated record_id). deliveryStatus always starts 'queued'.
   */
  async insert(
    userId: string,
    recipientAddress: string,
    deletionDate: Date,
  ): Promise<DeletionNotificationRecord> {
    const sql = `
      INSERT INTO account_deletion_notification_records
        (user_id, recipient_address, deletion_date, delivery_status)
      VALUES ($1, $2, $3, 'queued')
      RETURNING *
    `;

    const result: QueryResult<DeletionNotificationRecordRow> = await this.pool.query(sql, [
      userId,
      recipientAddress,
      deletionDate,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Return all outbox records matching the given delivery status, ordered by
   * dispatch_timestamp ascending (oldest first — FIFO dispatch order).
   */
  async findByStatus(
    status: 'queued' | 'sent' | 'failed',
  ): Promise<DeletionNotificationRecord[]> {
    const sql = `
      SELECT * FROM account_deletion_notification_records
      WHERE delivery_status = $1
      ORDER BY dispatch_timestamp ASC
    `;

    const result: QueryResult<DeletionNotificationRecordRow> = await this.pool.query(sql, [status]);

    return result.rows.map(rowToEntity);
  }

  /**
   * Update the delivery_status of the record identified by record_id.
   */
  async updateStatus(
    recordId: string,
    status: 'sent' | 'failed',
  ): Promise<void> {
    const sql = `
      UPDATE account_deletion_notification_records
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
      UPDATE account_deletion_notification_records
      SET retry_count = retry_count + 1
      WHERE record_id = $1
    `;

    await this.pool.query(sql, [recordId]);
  }
}
