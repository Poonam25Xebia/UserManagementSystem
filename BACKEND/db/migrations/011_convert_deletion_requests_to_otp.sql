-- Converts account_deletion_requests from a link-based confirmation token to
-- a 6-digit OTP code confirmed in-session. A 6-digit code has far fewer
-- possibilities than a 128-char token, so the old global uniqueness
-- constraint is dropped in favor of scoping lookups by user_id (already
-- indexed via idx_account_deletion_requests_user_status).

DROP INDEX IF EXISTS uidx_account_deletion_requests_token_value;

ALTER TABLE account_deletion_requests RENAME COLUMN token_value TO code_hash;
ALTER TABLE account_deletion_requests ALTER COLUMN code_hash TYPE VARCHAR(64);
