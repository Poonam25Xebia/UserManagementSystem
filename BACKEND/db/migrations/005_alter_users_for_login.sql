-- =============================================================================
-- Migration 005: Extend users table for login (F-03)
-- =============================================================================
-- Additive only — no change to existing columns or the `status` enum.
-- Temporary lockout is modelled as `locked_until` (a self-clearing throttle),
-- deliberately distinct from `status = 'suspended'` (an admin-driven disable).

ALTER TABLE users
  ADD COLUMN failed_login_count SMALLINT    NOT NULL DEFAULT 0,
  ADD COLUMN locked_until       TIMESTAMPTZ NULL,
  ADD COLUMN last_login_at      TIMESTAMPTZ NULL;

-- rollback
-- ALTER TABLE users DROP COLUMN IF EXISTS failed_login_count;
-- ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
