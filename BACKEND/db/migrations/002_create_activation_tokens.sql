-- =============================================================================
-- Migration 002: Create activation_tokens table
-- =============================================================================

CREATE TABLE activation_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_value VARCHAR(128) NOT NULL,
  issued_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ  NOT NULL,
  consumed    BOOLEAN      NOT NULL DEFAULT FALSE,
  consumed_at TIMESTAMPTZ  NULL
);

CREATE UNIQUE INDEX uidx_activation_tokens_token_value  ON activation_tokens(token_value);
CREATE INDEX        idx_activation_tokens_user_consumed ON activation_tokens(user_id, consumed);

-- rollback
-- DROP TABLE IF EXISTS activation_tokens CASCADE;
