/**
 * email-record.repository.ts
 *
 * Repository for the `registration_email_records` table (transactional outbox).
 * All queries use parameterised `?` placeholders — no string interpolation.
 *
 * Multi-instance safety (UMS-OUTBOX-1): every claim, release, retry-increment
 * and terminal-status write is a single conditional UPDATE whose WHERE clause
 * carries the guard, and each returns the affected-row count. Callers branch
 * on that count (0 = guard failed, e.g. another instance owns the record)
 * instead of reading state and writing it back. Timestamps are ISO-8601 UTC
 * strings, which compare correctly as text.
 *
 * Requirements: US-073 FR-007–009, UMS-OUTBOX-1 FR-001–004
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
  findById(recordId: string): Promise<RegistrationEmailRecord | null>;
  countByStatus(status: 'queued' | 'sent' | 'failed'): Promise<number>;
  findClaimable(now: Date): Promise<RegistrationEmailRecord[]>;
  claim(recordId: string, workerId: string, now: Date, leaseMs: number): Promise<number>;
  releaseClaim(recordId: string, workerId: string): Promise<number>;
  incrementRetryCountBelowMax(recordId: string, maxRetries: number): Promise<number>;
  markTerminal(recordId: string, status: 'sent' | 'failed'): Promise<number>;
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
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
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

  async findById(recordId: string): Promise<RegistrationEmailRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM registration_email_records WHERE record_id = ?')
      .get(recordId) as EmailRecordRow | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /** Number of records in the given delivery status (queue depth for 'queued'). */
  async countByStatus(status: 'queued' | 'sent' | 'failed'): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM registration_email_records WHERE delivery_status = ?')
      .get(status) as { n: number };
    return row.n;
  }

  /**
   * Queued records that are unclaimed or whose lease has expired, oldest
   * first. This is only a candidate list — a record is not owned until
   * claim() returns 1 for it.
   */
  async findClaimable(now: Date): Promise<RegistrationEmailRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM registration_email_records
          WHERE delivery_status = 'queued'
            AND (claim_expires_at IS NULL OR claim_expires_at <= ?)
          ORDER BY dispatch_timestamp ASC`,
      )
      .all(now.toISOString()) as EmailRecordRow[];

    return rows.map(rowToEntity);
  }

  /**
   * Claim a queued record for `workerId` with a lease of `leaseMs`. Succeeds
   * only while the record is queued and unclaimed or its lease has expired.
   * Returns 1 if this caller now owns the record, 0 otherwise.
   */
  async claim(recordId: string, workerId: string, now: Date, leaseMs: number): Promise<number> {
    const nowIso = now.toISOString();
    const expiresIso = new Date(now.getTime() + leaseMs).toISOString();
    return this.db
      .prepare(
        `UPDATE registration_email_records
            SET claimed_by = ?, claimed_at = ?, claim_expires_at = ?
          WHERE record_id = ?
            AND delivery_status = 'queued'
            AND (claim_expires_at IS NULL OR claim_expires_at <= ?)`,
      )
      .run(workerId, nowIso, expiresIso, recordId, nowIso).changes;
  }

  /**
   * Release a claim held by `workerId` so the record is immediately
   * claimable again. Returns 0 if `workerId` no longer holds the claim.
   */
  async releaseClaim(recordId: string, workerId: string): Promise<number> {
    return this.db
      .prepare(
        `UPDATE registration_email_records
            SET claimed_by = NULL, claimed_at = NULL, claim_expires_at = NULL
          WHERE record_id = ? AND claimed_by = ?`,
      )
      .run(recordId, workerId).changes;
  }

  /**
   * Increment retry_count by exactly one, but only while the record is
   * queued and retry_count < maxRetries. Returns 0 when the increment is
   * refused (maximum reached or record already terminal) — the caller then
   * marks the record failed instead.
   */
  async incrementRetryCountBelowMax(recordId: string, maxRetries: number): Promise<number> {
    return this.db
      .prepare(
        `UPDATE registration_email_records
            SET retry_count = retry_count + 1
          WHERE record_id = ?
            AND delivery_status = 'queued'
            AND retry_count < ?`,
      )
      .run(recordId, maxRetries).changes;
  }

  /**
   * Transition a queued record to a terminal status and clear its claim.
   * Guarded on delivery_status = 'queued' so a terminal record can never be
   * transitioned again (e.g. by a late-completing send). Returns 0 when the
   * record was already terminal.
   */
  async markTerminal(recordId: string, status: 'sent' | 'failed'): Promise<number> {
    return this.db
      .prepare(
        `UPDATE registration_email_records
            SET delivery_status = ?, claimed_by = NULL, claimed_at = NULL, claim_expires_at = NULL
          WHERE record_id = ? AND delivery_status = 'queued'`,
      )
      .run(status, recordId).changes;
  }
}
