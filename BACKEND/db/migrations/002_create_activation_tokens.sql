-- =============================================================================
-- Migration 002: Create activation_tokens table
-- =============================================================================

CREATE TABLE activation_tokens (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_value TEXT    NOT NULL,
  issued_at   TEXT    NOT NULL,
  expires_at  TEXT    NOT NULL,
  consumed    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT    NULL
);

CREATE UNIQUE INDEX uidx_activation_tokens_token_value  ON activation_tokens(token_value);
CREATE INDEX        idx_activation_tokens_user_consumed ON activation_tokens(user_id, consumed);
