-- =============================================================================
-- Migration 003: Create registration_email_records table
-- =============================================================================

CREATE TABLE registration_email_records (
  record_id           TEXT    PRIMARY KEY,
  user_id             TEXT    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  recipient_address   TEXT    NOT NULL,
  dispatch_timestamp  TEXT    NOT NULL,
  delivery_status     TEXT    NOT NULL DEFAULT 'queued'
                        CHECK (delivery_status IN ('queued', 'sent', 'failed')),
  retry_count         INTEGER NOT NULL DEFAULT 0,
  activation_token_id TEXT    REFERENCES activation_tokens(id) ON DELETE SET NULL
);

CREATE INDEX idx_reg_email_delivery_status ON registration_email_records(delivery_status);
