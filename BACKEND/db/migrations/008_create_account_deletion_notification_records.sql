-- =============================================================================
-- Migration 008: Create account_deletion_notification_records table (F-04)
-- =============================================================================
-- Transactional outbox record driving the post-deletion notification email
-- (US-033). Shaped like registration_email_records (F-01), polled by
-- AccountDeletionNotificationWorker.
--
-- No FK to users(id): by the time this row is queried by the worker, the
-- owning users row may already be anonymized by confirmDeletion — user_id
-- here is retained for logging only (design.md schema note).

CREATE TABLE account_deletion_notification_records (
  record_id           TEXT    PRIMARY KEY,
  user_id             TEXT    NOT NULL,
  recipient_address   TEXT    NOT NULL,
  deletion_date       TEXT    NOT NULL,
  dispatch_timestamp  TEXT    NOT NULL,
  delivery_status     TEXT    NOT NULL DEFAULT 'queued'
                         CHECK (delivery_status IN ('queued', 'sent', 'failed')),
  retry_count         INTEGER NOT NULL DEFAULT 0
);

-- Polled by AccountDeletionNotificationWorker.processQueuedRecords().
CREATE INDEX idx_deletion_notification_status
  ON account_deletion_notification_records(delivery_status);
