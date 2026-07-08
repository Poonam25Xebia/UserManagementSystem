/**
 * app.config.ts
 *
 * Loads application-level configuration from environment variables and
 * exports a strongly-typed `appConfig` object.
 *
 * Fail-fast rules enforced at module load:
 *   - BCRYPT_COST_FACTOR must be >= 12
 *   - ACTIVATION_BASE_URL must be present and non-empty
 *   - SENDGRID_API_KEY must be present and non-empty  (value is NEVER logged)
 *   - SENDGRID_TEMPLATE_ID must be present and non-empty
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppConfig {
  outboxPollIntervalMs: number;
  outboxMaxRetries: number;
  tokenExpiryHours: number;
  bcryptCostFactor: number;
  activationBaseUrl: string;
  adminBearerToken: string;
  /** Never log or expose this value. */
  sendgridApiKey: string;
  sendgridTemplateId: string;
  /** Verified SendGrid Single Sender address used as the "from" on outgoing emails. */
  fromEmail: string;
  /** Display name used alongside fromEmail. */
  fromName: string;
  /** F-03: expiry window for password-recovery tokens (US-036 FR-012). */
  passwordRecoveryTokenExpiryHours: number;
  /** F-03: base URL used to build the password-reset link sent in the recovery email. */
  passwordRecoveryBaseUrl: string;
  /** F-03: SendGrid dynamic template ID for the password-recovery email. */
  passwordRecoveryEmailTemplateId: string;
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

const outboxPollIntervalMs = parsePositiveInt('OUTBOX_POLL_INTERVAL_MS', 30_000);
const outboxMaxRetries = parsePositiveInt('OUTBOX_MAX_RETRIES', 1);
const tokenExpiryHours = parsePositiveInt('TOKEN_EXPIRY_HOURS', 24);
const bcryptCostFactor = parsePositiveInt('BCRYPT_COST_FACTOR', 12);

if (bcryptCostFactor < 12) {
  throw new Error(
    `Configuration error: BCRYPT_COST_FACTOR must be >= 12, got ${bcryptCostFactor}.`,
  );
}

const activationBaseUrl = requireEnvString('ACTIVATION_BASE_URL');
const adminBearerToken = requireEnvString('ADMIN_BEARER_TOKEN');
const sendgridApiKey = requireEnvString('SENDGRID_API_KEY');    // ← value intentionally not logged
const sendgridTemplateId = requireEnvString('SENDGRID_TEMPLATE_ID');
const fromEmail = requireEnvString('FROM_EMAIL');
const fromName = process.env.FROM_NAME?.trim() || 'User Management Service';
const passwordRecoveryTokenExpiryHours = parsePositiveInt(
  'PASSWORD_RECOVERY_TOKEN_EXPIRY_HOURS',
  1,
);
const passwordRecoveryBaseUrl = requireEnvString('PASSWORD_RECOVERY_BASE_URL');
const passwordRecoveryEmailTemplateId = requireEnvString('PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID');

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const appConfig: AppConfig = Object.freeze({
  outboxPollIntervalMs,
  outboxMaxRetries,
  tokenExpiryHours,
  bcryptCostFactor,
  activationBaseUrl,
  adminBearerToken,
  sendgridApiKey,
  sendgridTemplateId,
  fromEmail,
  fromName,
  passwordRecoveryTokenExpiryHours,
  passwordRecoveryBaseUrl,
  passwordRecoveryEmailTemplateId,
});
