-- =============================================================================
-- Migration 001: Create users table
-- =============================================================================

CREATE TABLE users (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username               VARCHAR(255) NOT NULL,
  username_normalised    VARCHAR(255) NOT NULL,
  email                  VARCHAR(320) NOT NULL,
  password_hash          VARCHAR(72)  NOT NULL,
  status                 VARCHAR(20)  NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'suspended')),
  registration_timestamp TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  activated_at           TIMESTAMPTZ  NULL
);

CREATE UNIQUE INDEX uidx_users_username_normalised ON users(username_normalised);
CREATE UNIQUE INDEX uidx_users_email               ON users(email);

-- rollback
-- DROP TABLE IF EXISTS users CASCADE;
