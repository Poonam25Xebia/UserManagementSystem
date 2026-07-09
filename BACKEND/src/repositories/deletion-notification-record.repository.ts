/**
 * deletion-notification-record.repository.ts
 *
 * Repository for the `account_deletion_notification_records` table
 * (transactional outbox). All queries use parameterised `?` placeholders —
 * no string interpolation.
 *
 * Same shape as EmailRecordRepository (F-01) — mirrors its method
 * signatures so AccountDeletionNotificationWorker can be structurally
 * identical to OutboxWorker.
 *
 * Requirements: US-033 FR-005–006
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
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
// Row type returned by better-sqlite3
// ---------------------------------------------------------------------------

interface DeletionNotificationRecordRow {
  record_id: string;
  user_id: string;
  recipient_address: string;
  deletion_date: string;
  dispatch_timestamp: string;
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
    deletionDate: new Date(row.deletion_date),
    dispatchTimestamp: new Date(row.dispatch_timestamp),
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
  constructor(private readonly db: Database) {}

  /**
   * Insert a new outbox record and return the persisted entity (with
   * generated record_id). deliveryStatus always starts 'queued'.
   */
  async insert(
    userId: string,
    recipientAddress: string,
    deletionDate: Date,
  ): Promise<DeletionNotificationRecord> {
    const recordId = uuidv4();
    this.db
      .prepare(
        `INSERT INTO account_deletion_notification_records
          (record_id, user_id, recipient_address, deletion_date, dispatch_timestamp, delivery_status)
         VALUES (?, ?, ?, ?, ?, 'queued')`,
      )
      .run(recordId, userId, recipientAddress, deletionDate.toISOString(), new Date().toISOString());

    const row = this.db
      .prepare('SELECT * FROM account_deletion_notification_records WHERE record_id = ?')
      .get(recordId) as DeletionNotificationRecordRow;
    return rowToEntity(row);
  }

  /**
   * Return all outbox records matching the given delivery status, ordered by
   * dispatch_timestamp ascending (oldest first — FIFO dispatch order).
   */
  async findByStatus(
    status: 'queued' | 'sent' | 'failed',
  ): Promise<DeletionNotificationRecord[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM account_deletion_notification_records WHERE delivery_status = ? ORDER BY dispatch_timestamp ASC',
      )
      .all(status) as DeletionNotificationRecordRow[];

    return rows.map(rowToEntity);
  }

  /**
   * Update the delivery_status of the record identified by record_id.
   */
  async updateStatus(
    recordId: string,
    status: 'sent' | 'failed',
  ): Promise<void> {
    this.db
      .prepare(
        'UPDATE account_deletion_notification_records SET delivery_status = ? WHERE record_id = ?',
      )
      .run(status, recordId);
  }

  /**
   * Atomically increment retry_count by 1 for the record identified by
   * record_id.
   */
  async incrementRetryCount(recordId: string): Promise<void> {
    this.db
      .prepare(
        'UPDATE account_deletion_notification_records SET retry_count = retry_count + 1 WHERE record_id = ?',
      )
      .run(recordId);
  }
}
