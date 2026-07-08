/**
 * otp.config.ts
 *
 * Loads OTP-feature configuration from environment variables and exports a
 * strongly-typed `otpConfig` object.
 *
 * Requirements: US-002 FR-002, FR-004, FR-008, FR-011
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OtpConfig {
  otpLength: number;
  otpTtlMinutes: number;
  otpMaxAttemptsPerWindow: number;
  otpRateLimitWindowMinutes: number;
  otpHashAlgorithm: string;
  /** Never log or expose this value. */
  otpHashSecret: string;
  /** Gates whether OtpDeliveryPort actually dispatches (read from SMS_PROVIDER_ENABLED for continuity with task 1; delivery is via email — see task 2/5 deviation notes). */
  otpDeliveryEnabled: boolean;
  redisUrl: string;
  otpEmailTemplateId: string;
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

function parseBoolean(envKey: string, defaultValue: boolean): boolean {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return raw.trim().toLowerCase() === 'true';
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

const otpLength = parsePositiveInt('OTP_LENGTH', 6);
const otpTtlMinutes = parsePositiveInt('OTP_TTL_MINUTES', 10);
const otpMaxAttemptsPerWindow = parsePositiveInt('OTP_MAX_ATTEMPTS_PER_WINDOW', 5);
const otpRateLimitWindowMinutes = parsePositiveInt('OTP_RATE_LIMIT_WINDOW_MINUTES', 15);
const otpHashAlgorithm = process.env.OTP_HASH_ALGORITHM?.trim() || 'sha256';
const otpHashSecret = requireEnvString('OTP_HASH_SECRET');   // ← value intentionally not logged
const otpDeliveryEnabled = parseBoolean('SMS_PROVIDER_ENABLED', true);
const redisUrl = process.env.REDIS_URL?.trim() || 'redis://localhost:6379';
const otpEmailTemplateId = requireEnvString('OTP_EMAIL_TEMPLATE_ID');

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const otpConfig: OtpConfig = Object.freeze({
  otpLength,
  otpTtlMinutes,
  otpMaxAttemptsPerWindow,
  otpRateLimitWindowMinutes,
  otpHashAlgorithm,
  otpHashSecret,
  otpDeliveryEnabled,
  redisUrl,
  otpEmailTemplateId,
});
