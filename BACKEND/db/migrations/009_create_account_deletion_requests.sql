-- =============================================================================
-- Migration 009: Create account_deletion_requests table (F-04)
-- =============================================================================
-- Single-use, time-bounded confirmation token guarding account deletion.
-- Shaped like activation_tokens (F-01): one row per deletion attempt,
-- status transitions pending -> {confirmed | cancelled} one-way.
-- "One active request per user" is enforced in the service layer (a second
-- pending insert is rejected with 409 before it happens), not via a partial
-- unique index — see design.md schema note.

CREATE TABLE account_deletion_requests (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_value   VARCHAR(128) NOT NULL,
  issued_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ  NOT NULL,
  status        VARCHAR(10)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  confirmed_at  TIMESTAMPTZ  NULL,
  cancelled_at  TIMESTAMPTZ  NULL
);

-- O(1) lookup on confirm (findByTokenValue).
CREATE UNIQUE INDEX uidx_account_deletion_requests_token_value
  ON account_deletion_requests(token_value);

-- Lookup of the caller's own pending request (request/cancel flows).
CREATE INDEX idx_account_deletion_requests_user_status
  ON account_deletion_requests(user_id, status);

-- rollback
-- DROP TABLE IF EXISTS account_deletion_requests CASCADE;
