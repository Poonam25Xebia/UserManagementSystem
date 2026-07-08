/**
 * password-policy.config.ts
 *
 * Loads the PasswordPolicy from environment variables and exports a
 * strongly-typed `passwordPolicyConfig` object.
 *
 * Fail-fast rules enforced at module load:
 *   - PASSWORD_MIN_LENGTH must be >= 1
 *   - PASSWORD_MAX_LENGTH must be <= 1024
 *   - min must not exceed max
 */

import type { PasswordPolicy } from '../types/registration.types';

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

function parseBool(envKey: string, defaultValue: boolean): boolean {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const lower = raw.trim().toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  throw new Error(
    `Configuration error: ${envKey} must be 'true' or 'false', got '${raw}'.`,
  );
}

// ---------------------------------------------------------------------------
// Load and validate
// ---------------------------------------------------------------------------

const minimumLength = parsePositiveInt('PASSWORD_MIN_LENGTH', 8);
const maximumLength = parsePositiveInt('PASSWORD_MAX_LENGTH', 128);
const requiresUppercase = parseBool('PASSWORD_REQUIRES_UPPERCASE', true);
const requiresLowercase = parseBool('PASSWORD_REQUIRES_LOWERCASE', true);
const requiresDigit = parseBool('PASSWORD_REQUIRES_DIGIT', true);
const requiresSpecialCharacter = parseBool('PASSWORD_REQUIRES_SPECIAL', true);

if (minimumLength < 1) {
  throw new Error(
    `Configuration error: PASSWORD_MIN_LENGTH must be >= 1, got ${minimumLength}.`,
  );
}

if (maximumLength > 1024) {
  throw new Error(
    `Configuration error: PASSWORD_MAX_LENGTH must be <= 1024, got ${maximumLength}.`,
  );
}

if (minimumLength > maximumLength) {
  throw new Error(
    `Configuration error: PASSWORD_MIN_LENGTH (${minimumLength}) must not exceed PASSWORD_MAX_LENGTH (${maximumLength}).`,
  );
}

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const passwordPolicyConfig: PasswordPolicy = Object.freeze({
  minimumLength,
  maximumLength,
  requiresUppercase,
  requiresLowercase,
  requiresDigit,
  requiresSpecialCharacter,
});
