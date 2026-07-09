-- =============================================================================
-- Migration 004: Create otp_requests table
-- =============================================================================
-- OTP delivery is via email (not SMS) for this deployment; email_address is
-- captured at issuance time from users.email.

CREATE TABLE otp_requests (
  id               TEXT    PRIMARY KEY,
  user_id          TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_address    TEXT    NOT NULL,
  code_hash        TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'delivered', 'failed')),
  created_at       TEXT    NOT NULL,
  expires_at       TEXT    NOT NULL,
  invalidated_at   TEXT    NULL,
  attempt_sequence INTEGER NOT NULL
);

-- Enforce at most one active (non-invalidated) OTP per user.
CREATE UNIQUE INDEX uidx_otp_requests_active_per_user
  ON otp_requests(user_id)
  WHERE invalidated_at IS NULL;

-- Rate-limit and lookup window queries.
CREATE INDEX idx_otp_requests_user_created ON otp_requests(user_id, created_at);

-- Expiry cleanup sweeps.
CREATE INDEX idx_otp_requests_expires_at ON otp_requests(expires_at);
