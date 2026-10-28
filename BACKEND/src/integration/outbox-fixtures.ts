/**
 * outbox-fixtures.ts
 *
 * Test-only helpers for seeding registration_email_records (and the users /
 * activation_tokens rows they reference) directly into a real SQLite handle.
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface SeededRecord {
  recordId: string;
  userId: string;
  recipientAddress: string;
}

export interface SeedOptions {
  retryCount?: number;
  deliveryStatus?: 'queued' | 'sent' | 'failed';
  dispatchTimestamp?: Date;
}

export function seedEmailRecord(db: Database, options: SeedOptions = {}): SeededRecord {
  const userId = uuidv4();
  const tokenId = uuidv4();
  const recordId = uuidv4();
  const suffix = userId.slice(0, 8);
  const recipientAddress = `user-${suffix}@example.test`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, username, username_normalised, email, password_hash, status, registration_timestamp)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(userId, `user-${suffix}`, `user-${suffix}`, recipientAddress, 'hash', now);

  db.prepare(
    `INSERT INTO activation_tokens (id, user_id, token_value, issued_at, expires_at, consumed)
     VALUES (?, ?, ?, ?, ?, 0)`,
  ).run(tokenId, userId, `token-${userId}`, now, new Date(Date.now() + 86_400_000).toISOString());

  db.prepare(
    `INSERT INTO registration_email_records
       (record_id, user_id, recipient_address, dispatch_timestamp, delivery_status, retry_count, activation_token_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    recordId,
    userId,
    recipientAddress,
    (options.dispatchTimestamp ?? new Date()).toISOString(),
    options.deliveryStatus ?? 'queued',
    options.retryCount ?? 0,
    tokenId,
  );

  return { recordId, userId, recipientAddress };
}

export interface RawEmailRecordRow {
  record_id: string;
  delivery_status: 'queued' | 'sent' | 'failed';
  retry_count: number;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
}

export function readRawRecord(db: Database, recordId: string): RawEmailRecordRow {
  return db
    .prepare('SELECT * FROM registration_email_records WHERE record_id = ?')
    .get(recordId) as RawEmailRecordRow;
}
