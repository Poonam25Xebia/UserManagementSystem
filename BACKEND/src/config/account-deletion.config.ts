/**
 * account-deletion.config.ts
 *
 * Loads Account Deletion Feature (F-04) configuration from environment
 * variables and exports a strongly-typed `accountDeletionConfig` object.
 * Fail-fast at module load, mirroring app.config.ts's `requireEnvString`
 * pattern: the two template-id values are required and non-empty.
 *
 * The OTP hash secret/algorithm are intentionally reused from otp.config.ts
 * rather than re-declared here — both features hash a numeric code with an
 * HMAC keyed secret, so it's the same primitive, not registration-specific
 * behavior.
 */

import { otpConfig } from './otp.config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountDeletionConfig {
  /** Minutes until a deletion-confirmation OTP code expires (US-023 FR-003). */
  otpExpiryMinutes: number;
  /** SendGrid dynamic template ID for the deletion-confirmation-request email. */
  requestEmailTemplateId: string;
  /** SendGrid dynamic template ID for the post-deletion notice email (US-033). */
  noticeEmailTemplateId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePositiveInt(envKey: string, defaultValue: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(
      `Configuration error: ${envKey} must be an integer, got '${raw}'.`,
    );
  }
  return parsed;
}

function requireEnvString(envKey: string): string {
  const value = process.env[envKey];
  if (!value || value.trim() === '') {
    throw new Error(
      `Configuration error: required environment variable '${envKey}' is absent or empty.`,
    );
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// Load values
// ---------------------------------------------------------------------------

const otpExpiryMinutes = parsePositiveInt('ACCOUNT_DELETION_OTP_EXPIRY_MINUTES', otpConfig.otpTtlMinutes);
const requestEmailTemplateId = requireEnvString('ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID');
const noticeEmailTemplateId = requireEnvString('ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID');

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const accountDeletionConfig: AccountDeletionConfig = Object.freeze({
  otpExpiryMinutes,
  requestEmailTemplateId,
  noticeEmailTemplateId,
});
