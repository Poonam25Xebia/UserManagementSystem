-- =============================================================================
-- Migration 005: Create sessions table (F-03)
-- =============================================================================
-- Only the SHA-256 hash of the raw session token is ever persisted here — the
-- raw token is returned to the client exactly once and never stored or logged.

CREATE TABLE sessions (
  id             TEXT    PRIMARY KEY,
  user_id        TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     TEXT    NOT NULL,
  created_at     TEXT    NOT NULL,
  expires_at     TEXT    NOT NULL,
  invalidated    INTEGER NOT NULL DEFAULT 0,
  invalidated_at TEXT    NULL
);

-- O(1) lookup on every authenticated request (validateSession).
CREATE UNIQUE INDEX uidx_sessions_token_hash ON sessions(token_hash);

-- Bulk invalidation on suspension cascade (EC-003) and password reset (FR-018).
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Scheduled cleanup of expired-but-not-yet-invalidated rows.
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE invalidated = 0;
