/**
 * lockout.config.ts
 *
 * Loads account-lockout policy configuration from environment variables and
 * exports a strongly-typed `lockoutConfig` object.
 *
 * Defaults (5 consecutive failures -> 15-minute lockout) are the assumption
 * reconciled in .kiro/specs/user_login/design.md Requirements Reconciliation
 * #4. [NEEDS CLARIFICATION: exact threshold/duration to be confirmed by
 * product — both values are config-driven so the assumption is cheap to
 * change without a code change.]
 *
 * Requirements: US-036 FR-008, US-039 FR-008
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LockoutConfig {
  loginLockoutThreshold: number;
  loginLockoutDurationMinutes: number;
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

// ---------------------------------------------------------------------------
// Load and validate
// ---------------------------------------------------------------------------

const loginLockoutThreshold = parsePositiveInt('LOGIN_LOCKOUT_THRESHOLD', 5);
const loginLockoutDurationMinutes = parsePositiveInt(
  'LOGIN_LOCKOUT_DURATION_MINUTES',
  15,
);

if (loginLockoutThreshold < 1) {
  throw new Error(
    `Configuration error: LOGIN_LOCKOUT_THRESHOLD must be >= 1, got ${loginLockoutThreshold}.`,
  );
}

if (loginLockoutDurationMinutes < 1) {
  throw new Error(
    `Configuration error: LOGIN_LOCKOUT_DURATION_MINUTES must be >= 1, got ${loginLockoutDurationMinutes}.`,
  );
}

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const lockoutConfig: LockoutConfig = Object.freeze({
  loginLockoutThreshold,
  loginLockoutDurationMinutes,
});
