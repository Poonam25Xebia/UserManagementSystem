-- =============================================================================
-- Migration 006: Create password_recovery_requests table (F-03)
-- =============================================================================
-- token is a 128-char base64url string, matching the F-01 activation_tokens
-- convention (crypto.randomBytes(96)).

CREATE TABLE password_recovery_requests (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT    NOT NULL,
  requested_at TEXT    NOT NULL,
  expires_at   TEXT    NOT NULL,
  consumed     INTEGER NOT NULL DEFAULT 0,
  consumed_at  TEXT    NULL
);

CREATE UNIQUE INDEX uidx_prr_token   ON password_recovery_requests(token);
CREATE INDEX        idx_prr_user_id ON password_recovery_requests(user_id);
