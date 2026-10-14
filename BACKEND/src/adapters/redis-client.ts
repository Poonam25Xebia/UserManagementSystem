/**
 * redis-client.ts
 *
 * Factory for the shared ioredis client. Applies the resilience options from
 * redis.config.ts and attaches connection lifecycle listeners so that
 * connection errors are logged (never thrown as unhandled 'error' events)
 * while the client reconnects in the background.
 *
 * The Redis URL is never logged because it may embed credentials.
 */

import { Redis } from 'ioredis';
import { RedisConfig, buildRedisOptions, redisConfig } from '../config/redis.config';

export interface RedisClientLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const LOG_PREFIX = '[Redis]';

export function createRedisClient(
  config: RedisConfig = redisConfig,
  logger: RedisClientLogger = console,
): Redis {
  const client = new Redis(config.redisUrl, buildRedisOptions(config));

  client.on('ready', () => logger.info(`${LOG_PREFIX} connection ready`));
  client.on('error', (err: Error) => logger.error(`${LOG_PREFIX} connection error: ${err.message}`));
  client.on('reconnecting', (delayMs: number) =>
    logger.warn(`${LOG_PREFIX} connection lost; reconnecting in ${delayMs}ms`),
  );
  client.on('end', () => logger.info(`${LOG_PREFIX} connection closed`));

  return client;
}

/**
 * Gracefully closes the client: QUIT (flushes pending replies) when
 * connected, otherwise an immediate disconnect that also cancels any pending
 * reconnection attempt. Safe to call more than once.
 */
export async function closeRedisClient(client: Redis, timeoutMs = 2000): Promise<void> {
  if (hasEnded(client)) {
    return;
  }
  if (client.status !== 'ready') {
    client.disconnect(false);
    return;
  }

  const ended = new Promise<void>((resolve) => client.once('end', () => resolve()));
  try {
    await client.quit();
  } catch {
    client.disconnect(false);
  }

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
    timer.unref();
  });
  await Promise.race([ended, timedOut]);
  clearTimeout(timer);

  if (!hasEnded(client)) {
    client.disconnect(false);
  }
}

function hasEnded(client: Redis): boolean {
  return client.status === 'end';
}
