-- =============================================================================
-- Migration 003: Create registration_email_records table
-- =============================================================================

CREATE TABLE registration_email_records (
  record_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  recipient_address   VARCHAR(320) NOT NULL,
  dispatch_timestamp  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  delivery_status     VARCHAR(10)  NOT NULL DEFAULT 'queued'
                        CHECK (delivery_status IN ('queued', 'sent', 'failed')),
  retry_count         SMALLINT     NOT NULL DEFAULT 0,
  activation_token_id UUID         REFERENCES activation_tokens(id) ON DELETE SET NULL
);

CREATE INDEX idx_reg_email_delivery_status ON registration_email_records(delivery_status);

-- rollback
-- DROP TABLE IF EXISTS registration_email_records CASCADE;
