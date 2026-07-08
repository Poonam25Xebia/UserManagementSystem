-- =============================================================================
-- Migration 010: Create account_deletion_notification_records table (F-04)
-- =============================================================================
-- Transactional outbox record driving the post-deletion notification email
-- (US-033). Shaped like registration_email_records (F-01), polled by
-- AccountDeletionNotificationWorker.
--
-- No FK to users(id): by the time this row is queried by the worker, the
-- owning users row may already be anonymized by confirmDeletion — user_id
-- here is retained for logging only (design.md schema note).

CREATE TABLE account_deletion_notification_records (
  record_id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL,
  recipient_address VARCHAR(320) NOT NULL,
  deletion_date     TIMESTAMPTZ  NOT NULL,
  dispatch_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status   VARCHAR(10)  NOT NULL DEFAULT 'queued'
                       CHECK (delivery_status IN ('queued', 'sent', 'failed')),
  retry_count       SMALLINT     NOT NULL DEFAULT 0
);

-- Polled by AccountDeletionNotificationWorker.processQueuedRecords().
CREATE INDEX idx_deletion_notification_status
  ON account_deletion_notification_records(delivery_status);

-- rollback
-- DROP TABLE IF EXISTS account_deletion_notification_records CASCADE;
