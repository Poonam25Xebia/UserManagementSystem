-- =============================================================================
-- Migration 001: Create users table (final shape — folds original 001+005+008)
-- =============================================================================

CREATE TABLE users (
  id                     TEXT         PRIMARY KEY,
  username               TEXT         NOT NULL,
  username_normalised    TEXT         NOT NULL,
  email                  TEXT         NOT NULL,
  password_hash          TEXT         NOT NULL,
  status                 TEXT         NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  registration_timestamp TEXT         NOT NULL,
  activated_at           TEXT         NULL,
  failed_login_count     INTEGER      NOT NULL DEFAULT 0,
  locked_until           TEXT         NULL,
  last_login_at          TEXT         NULL,
  deleted_at             TEXT         NULL
);

CREATE UNIQUE INDEX uidx_users_username_normalised ON users(username_normalised);
CREATE UNIQUE INDEX uidx_users_email               ON users(email);
