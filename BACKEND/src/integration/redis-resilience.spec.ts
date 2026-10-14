process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.REDIS_URL = REDIS_URL;

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { loadRedisConfig, RedisConfig } from '../config/redis.config';
import { closeRedisClient, createRedisClient, RedisClientLogger } from '../adapters/redis-client';
import { RedisRateLimitGuard } from '../services/rate-limit.guard';

/**
 * Exercises the production Redis client factory against a real Redis
 * (REDIS_URL): sustained concurrent load, a server-side disconnect, and a
 * full client restart.
 */

const config: RedisConfig = loadRedisConfig({
  REDIS_URL,
  REDIS_CONNECTION_NAME: `ums-resilience-${uuidv4()}`,
  REDIS_RETRY_BASE_DELAY_MS: '20',
  REDIS_RETRY_MAX_DELAY_MS: '200',
});

interface CountingLogger extends RedisClientLogger {
  errors: string[];
  warnings: string[];
}

function countingLogger(): CountingLogger {
  const errors: string[] = [];
  const warnings: string[] = [];
  return {
    errors,
    warnings,
    info: () => undefined,
    warn: (m) => warnings.push(m),
    error: (m) => errors.push(m),
  };
}

function waitForReady(client: Redis): Promise<void> {
  if (client.status === 'ready') return Promise.resolve();
  return new Promise((resolve) => client.once('ready', () => resolve()));
}

const keyPrefix = `ums:resilience:${uuidv4()}`;
let admin: Redis;

beforeAll(async () => {
  admin = new Redis(REDIS_URL);
  await waitForReady(admin);
});

afterAll(async () => {
  const keys = await admin.keys(`${keyPrefix}*`);
  const rlKeys = await admin.keys(`otp:rl:${keyPrefix}*`);
  if (keys.length + rlKeys.length > 0) {
    await admin.del(...keys, ...rlKeys);
  }
  await admin.quit();
});

describe('Integration | Redis reliability and resilience', () => {
  // S5-AC1
  test('S5-AC1: sustains concurrent load with no errors and exact rate-limit counts', async () => {
    const logger = countingLogger();
    const client = createRedisClient(config, logger);
    try {
      await waitForReady(client);
      const guard = new RedisRateLimitGuard(client, 1_000_000, 15);
      const users = Array.from({ length: 50 }, (_, i) => `${keyPrefix}:load-user-${i}`);
      const attemptsPerUser = 40;

      const results = await Promise.all(
        users.flatMap((user) => Array.from({ length: attemptsPerUser }, () => guard.allow(user))),
      );

      expect(results).toHaveLength(users.length * attemptsPerUser);
      expect(results.every((allowed) => allowed)).toBe(true);
      for (const user of users) {
        const key = `otp:rl:${user}`;
        expect(Number(await admin.get(key))).toBe(attemptsPerUser);
        const ttl = await admin.ttl(key);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(15 * 60);
      }

      const writes = await Promise.all(
        Array.from({ length: 2000 }, (_, i) => client.set(`${keyPrefix}:load:${i}`, String(i))),
      );
      expect(writes.every((reply) => reply === 'OK')).toBe(true);
      expect(logger.errors).toEqual([]);
    } finally {
      await closeRedisClient(client);
    }
  });

  // S5-AC2
  test('S5-AC2: reconnects after a server-side disconnect without losing or corrupting data', async () => {
    const logger = countingLogger();
    const client = createRedisClient(config, logger);
    try {
      await waitForReady(client);
      const guard = new RedisRateLimitGuard(client, 5, 15);
      const user = `${keyPrefix}:reconnect-user`;
      const dataKey = `${keyPrefix}:reconnect:data`;

      await client.set(dataKey, 'before-disconnect');
      await expect(guard.allow(user)).resolves.toBe(true);
      await expect(guard.allow(user)).resolves.toBe(true);

      const clientId = await client.client('ID');
      const reconnected = new Promise<void>((resolve) => client.once('ready', () => resolve()));
      await admin.client('KILL', 'ID', String(clientId));

      // Issued while the connection is down: queued offline and replayed on reconnect.
      const [readBack, write, thirdAttempt] = await Promise.all([
        client.get(dataKey),
        client.set(`${keyPrefix}:reconnect:after`, 'after-disconnect'),
        guard.allow(user),
      ]);
      await reconnected;

      expect(logger.warnings.some((m) => m.includes('reconnecting'))).toBe(true);
      expect(readBack).toBe('before-disconnect');
      expect(write).toBe('OK');
      expect(thirdAttempt).toBe(true);
      expect(await admin.get(`${keyPrefix}:reconnect:after`)).toBe('after-disconnect');
      expect(Number(await admin.get(`otp:rl:${user}`))).toBe(3);
      expect(await admin.ttl(`otp:rl:${user}`)).toBeGreaterThan(0);
      expect(Number(await client.client('ID'))).not.toBe(Number(clientId));
    } finally {
      await closeRedisClient(client);
    }
  });

  // S5-AC3
  test('S5-AC3: a restarted service initialises its Redis connection without errors and sees prior state', async () => {
    const restartConfig = loadRedisConfig({ ...process.env, REDIS_URL });
    const dataKey = `${keyPrefix}:restart:data`;

    const firstLogger = countingLogger();
    const first = createRedisClient(restartConfig, firstLogger);
    await waitForReady(first);
    await first.set(dataKey, 'persisted');
    await closeRedisClient(first);
    expect(first.status).toBe('end');

    const secondLogger = countingLogger();
    const second = createRedisClient(restartConfig, secondLogger);
    try {
      await waitForReady(second);
      expect(await second.ping()).toBe('PONG');
      expect(await second.get(dataKey)).toBe('persisted');
      expect(firstLogger.errors).toEqual([]);
      expect(secondLogger.errors).toEqual([]);
      expect(secondLogger.warnings).toEqual([]);
    } finally {
      await closeRedisClient(second);
    }
  });
});
