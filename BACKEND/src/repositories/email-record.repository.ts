/**
 * email-record.repository.ts
 *
 * Repository for the `registration_email_records` table (transactional outbox).
 * All queries use parameterised `?` placeholders — no string interpolation.
 *
 * Requirements: US-073 FR-007–009
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
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
// Row type returned by better-sqlite3
// ---------------------------------------------------------------------------

interface EmailRecordRow {
  record_id: string;
  user_id: string;
  recipient_address: string;
  dispatch_timestamp: string;
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
    dispatchTimestamp: new Date(row.dispatch_timestamp),
    deliveryStatus: row.delivery_status,
    retryCount: row.retry_count,
    activationTokenId: row.activation_token_id,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class EmailRecordRepository implements IEmailRecordRepository {
  constructor(private readonly db: Database) {}

  /**
   * Insert a new outbox record and return the persisted entity (with
   * generated record_id).
   */
  async insert(
    record: Omit<RegistrationEmailRecord, 'recordId'>,
  ): Promise<RegistrationEmailRecord> {
    const recordId = uuidv4();
    this.db
      .prepare(
        `INSERT INTO registration_email_records
          (record_id, user_id, recipient_address, dispatch_timestamp, delivery_status,
           retry_count, activation_token_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        recordId,
        record.userId,
        record.recipientAddress,
        record.dispatchTimestamp.toISOString(),
        record.deliveryStatus,
        record.retryCount,
        record.activationTokenId,
      );

    const row = this.db
      .prepare('SELECT * FROM registration_email_records WHERE record_id = ?')
      .get(recordId) as EmailRecordRow;
    return rowToEntity(row);
  }

  /**
   * Return all outbox records matching the given delivery status, ordered by
   * dispatch_timestamp ascending (oldest first — FIFO dispatch order).
   */
  async findByStatus(
    status: 'queued' | 'sent' | 'failed',
  ): Promise<RegistrationEmailRecord[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM registration_email_records WHERE delivery_status = ? ORDER BY dispatch_timestamp ASC',
      )
      .all(status) as EmailRecordRow[];

    return rows.map(rowToEntity);
  }

  /**
   * Look up a single outbox record by the owning user's UUID.
   * Returns null if not found (UNIQUE constraint enforces one per user).
   */
  async findByUserId(userId: string): Promise<RegistrationEmailRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM registration_email_records WHERE user_id = ? LIMIT 1')
      .get(userId) as EmailRecordRow | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Update the delivery_status of the record identified by record_id.
   */
  async updateStatus(
    recordId: string,
    status: 'queued' | 'sent' | 'failed',
  ): Promise<void> {
    this.db
      .prepare('UPDATE registration_email_records SET delivery_status = ? WHERE record_id = ?')
      .run(status, recordId);
  }

  /**
   * Atomically increment retry_count by 1 for the record identified by
   * record_id.
   */
  async incrementRetryCount(recordId: string): Promise<void> {
    this.db
      .prepare(
        'UPDATE registration_email_records SET retry_count = retry_count + 1 WHERE record_id = ?',
      )
      .run(recordId);
  }
}
