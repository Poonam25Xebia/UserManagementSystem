/**
 * redis.config.ts
 *
 * Loads Redis connection/resilience configuration from environment variables
 * and exports a strongly-typed `redisConfig` object plus a helper that turns
 * it into ioredis `RedisOptions` (timeouts, reconnect backoff, failover
 * handling, offline queueing).
 *
 * Invalid values fail fast at startup with a descriptive configuration error.
 */

import type { RedisOptions } from 'ioredis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RedisConfig {
  /** May embed credentials — never log this value. */
  redisUrl: string;
  connectionName: string;
  connectTimeoutMs: number;
  /** 0 disables the per-command timeout. */
  commandTimeoutMs: number;
  /** Reconnection attempts a queued command survives before being rejected. */
  maxRetriesPerRequest: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  keepAliveMs: number;
}

type Env = Record<string, string | undefined>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNonNegativeInt(env: Env, envKey: string, defaultValue: number): number {
  const raw = env[envKey];
  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Configuration error: ${envKey} must be a non-negative integer, got '${raw}'.`,
    );
  }
  return parseInt(trimmed, 10);
}

function parsePositiveInt(env: Env, envKey: string, defaultValue: number): number {
  const value = parseNonNegativeInt(env, envKey, defaultValue);
  if (value <= 0) {
    throw new Error(`Configuration error: ${envKey} must be greater than 0, got '${value}'.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadRedisConfig(env: Env = process.env): RedisConfig {
  const redisUrl = env.REDIS_URL?.trim() || 'redis://localhost:6379';
  if (!/^rediss?:\/\//i.test(redisUrl)) {
    throw new Error(
      "Configuration error: REDIS_URL must start with 'redis://' or 'rediss://'.",
    );
  }

  const retryBaseDelayMs = parsePositiveInt(env, 'REDIS_RETRY_BASE_DELAY_MS', 100);
  const retryMaxDelayMs = parsePositiveInt(env, 'REDIS_RETRY_MAX_DELAY_MS', 5000);
  if (retryMaxDelayMs < retryBaseDelayMs) {
    throw new Error(
      'Configuration error: REDIS_RETRY_MAX_DELAY_MS must be >= REDIS_RETRY_BASE_DELAY_MS.',
    );
  }

  return Object.freeze({
    redisUrl,
    connectionName: env.REDIS_CONNECTION_NAME?.trim() || 'user-management-service',
    connectTimeoutMs: parsePositiveInt(env, 'REDIS_CONNECT_TIMEOUT_MS', 10000),
    commandTimeoutMs: parseNonNegativeInt(env, 'REDIS_COMMAND_TIMEOUT_MS', 5000),
    maxRetriesPerRequest: parseNonNegativeInt(env, 'REDIS_MAX_RETRIES_PER_REQUEST', 3),
    retryBaseDelayMs,
    retryMaxDelayMs,
    keepAliveMs: parseNonNegativeInt(env, 'REDIS_KEEP_ALIVE_MS', 30000),
  });
}

// ---------------------------------------------------------------------------
// ioredis options
// ---------------------------------------------------------------------------

/**
 * Exponential reconnect backoff capped at `retryMaxDelayMs`. Never returns
 * null, so the client keeps trying to reconnect for as long as it is open.
 */
export function computeRetryDelay(attempt: number, config: RedisConfig): number {
  const exponent = Math.min(Math.max(attempt, 1) - 1, 30);
  return Math.min(config.retryBaseDelayMs * 2 ** exponent, config.retryMaxDelayMs);
}

/**
 * After a failover the old primary may be demoted to a read-only replica.
 * Reconnect and resend the failed command so it reaches the new primary.
 */
export function shouldReconnectOnError(err: Error): boolean | 1 | 2 {
  return err.message.startsWith('READONLY') ? 2 : false;
}

export function buildRedisOptions(config: RedisConfig): RedisOptions {
  return {
    connectionName: config.connectionName,
    connectTimeout: config.connectTimeoutMs,
    commandTimeout: config.commandTimeoutMs > 0 ? config.commandTimeoutMs : undefined,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    keepAlive: config.keepAliveMs,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    retryStrategy: (times: number) => computeRetryDelay(times, config),
    reconnectOnError: shouldReconnectOnError,
  };
}

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const redisConfig: RedisConfig = loadRedisConfig();
