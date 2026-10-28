-- =============================================================================
-- Migration 009: Add claim/lease columns to registration_email_records
-- =============================================================================
-- Lets multiple OutboxWorker instances share the queue safely. A worker takes
-- a record with a conditional UPDATE (see EmailRecordRepository.claim) that
-- only succeeds while the record is queued and unclaimed or its lease has
-- expired. claim_expires_at bounds the claim so a crashed worker's records
-- become claimable again.

ALTER TABLE registration_email_records ADD COLUMN claimed_by       TEXT      NULL;
ALTER TABLE registration_email_records ADD COLUMN claimed_at       TIMESTAMP NULL;
ALTER TABLE registration_email_records ADD COLUMN claim_expires_at TIMESTAMP NULL;

-- Covers the claim / claimable-selection predicate:
--   delivery_status = 'queued' AND (claim_expires_at IS NULL OR claim_expires_at <= ?)
-- Its leading column also serves the existing delivery_status lookups, so it
-- replaces idx_reg_email_delivery_status (otherwise the planner keeps picking
-- the narrower index for the claim predicate).
DROP INDEX IF EXISTS idx_reg_email_delivery_status;
CREATE INDEX idx_reg_email_status_claim_expiry
  ON registration_email_records(delivery_status, claim_expires_at);
