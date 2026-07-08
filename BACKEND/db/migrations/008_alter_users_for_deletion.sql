-- =============================================================================
-- Migration 008: Extend users table for account deletion (F-04)
-- =============================================================================
-- Adds a terminal 'deleted' status alongside the existing pending/active/
-- suspended values (F-01/F-03), plus a deleted_at timestamp. Deletion is a
-- soft delete: the row is never physically removed, only anonymized and
-- marked 'deleted' by AccountDeletionService.confirmDeletion (design.md
-- Requirements Reconciliation #6).

ALTER TABLE users
  ADD COLUMN deleted_at TIMESTAMPTZ NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_status_check
    CHECK (status IN ('pending', 'active', 'suspended', 'deleted'));

-- rollback
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
-- ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'active', 'suspended'));
-- ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
