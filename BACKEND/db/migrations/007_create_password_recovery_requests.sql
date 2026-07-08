-- =============================================================================
-- Migration 007: Create password_recovery_requests table (F-03)
-- =============================================================================
-- token is a 128-char base64url string, matching the F-01 activation_tokens
-- convention (crypto.randomBytes(96)).

CREATE TABLE password_recovery_requests (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        VARCHAR(128) NOT NULL,
  requested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  NOT NULL,
  consumed     BOOLEAN      NOT NULL DEFAULT FALSE,
  consumed_at  TIMESTAMPTZ  NULL
);

CREATE UNIQUE INDEX uidx_prr_token   ON password_recovery_requests(token);
CREATE INDEX        idx_prr_user_id ON password_recovery_requests(user_id);

-- rollback
-- DROP TABLE IF EXISTS password_recovery_requests CASCADE;
