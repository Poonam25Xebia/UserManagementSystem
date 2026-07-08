/**
 * session.config.ts
 *
 * Loads session-lifecycle configuration from environment variables and
 * exports a strongly-typed `sessionConfig` object.
 *
 * Requirements: US-038 FR-003, FR-010
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionConfig {
  sessionExpirySeconds: number;
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

const sessionExpirySeconds = parsePositiveInt('SESSION_EXPIRY_SECONDS', 3600);

if (sessionExpirySeconds < 1) {
  throw new Error(
    `Configuration error: SESSION_EXPIRY_SECONDS must be >= 1, got ${sessionExpirySeconds}.`,
  );
}

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const sessionConfig: SessionConfig = Object.freeze({
  sessionExpirySeconds,
});
