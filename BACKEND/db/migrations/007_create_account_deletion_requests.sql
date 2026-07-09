-- =============================================================================
-- Migration 007: Create account_deletion_requests table (F-04)
-- =============================================================================
-- Final shape — folds original 009+011: confirmation is a 6-digit OTP code
-- (code_hash), not a clickable-link token. Shaped like activation_tokens
-- (F-01): one row per deletion attempt, status transitions
-- pending -> {confirmed | cancelled} one-way.
-- "One active request per user" is enforced in the service layer (a second
-- pending insert is rejected with 409 before it happens), not via a partial
-- unique index — see design.md schema note.

CREATE TABLE account_deletion_requests (
  id            TEXT    PRIMARY KEY,
  user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash     TEXT    NOT NULL,
  issued_at     TEXT    NOT NULL,
  expires_at    TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  confirmed_at  TEXT    NULL,
  cancelled_at  TEXT    NULL
);

-- Lookup of the caller's own pending request (request/cancel/confirm flows).
CREATE INDEX idx_account_deletion_requests_user_status
  ON account_deletion_requests(user_id, status);
