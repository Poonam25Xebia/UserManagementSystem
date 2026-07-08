-- =============================================================================
-- Migration 006: Create sessions table (F-03)
-- =============================================================================
-- Only the SHA-256 hash of the raw session token is ever persisted here — the
-- raw token is returned to the client exactly once and never stored or logged.

CREATE TABLE sessions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     VARCHAR(64)  NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ  NOT NULL,
  invalidated    BOOLEAN      NOT NULL DEFAULT FALSE,
  invalidated_at TIMESTAMPTZ  NULL
);

-- O(1) lookup on every authenticated request (validateSession).
CREATE UNIQUE INDEX uidx_sessions_token_hash ON sessions(token_hash);

-- Bulk invalidation on suspension cascade (EC-003) and password reset (FR-018).
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Scheduled cleanup of expired-but-not-yet-invalidated rows.
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE invalidated = FALSE;

-- rollback
-- DROP TABLE IF EXISTS sessions CASCADE;
