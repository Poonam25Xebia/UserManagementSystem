import { Redis } from 'ioredis';
import { loadRedisConfig } from '../config/redis.config';
import { closeRedisClient, createRedisClient, RedisClientLogger } from './redis-client';

/**
 * Points the client at a local port nothing listens on, so connection
 * attempts are refused immediately — no external Redis is needed.
 */
const unreachableConfig = loadRedisConfig({
  REDIS_URL: 'redis://user:topsecret@127.0.0.1:1',
  REDIS_RETRY_BASE_DELAY_MS: '10',
  REDIS_RETRY_MAX_DELAY_MS: '20',
  REDIS_MAX_RETRIES_PER_REQUEST: '1',
  REDIS_CONNECT_TIMEOUT_MS: '500',
});

function recordingLogger(): RedisClientLogger & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    info: jest.fn((m: string) => messages.push(m)),
    warn: jest.fn((m: string) => messages.push(m)),
    error: jest.fn((m: string) => messages.push(m)),
  };
}

function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for condition'));
      }
    }, 10);
  });
}

describe('createRedisClient', () => {
  let client: Redis | undefined;

  afterEach(async () => {
    if (client) {
      await closeRedisClient(client);
      client = undefined;
    }
  });

  test('starts without throwing when Redis is unreachable and keeps reconnecting', async () => {
    const logger = recordingLogger();

    client = createRedisClient(unreachableConfig, logger);

    await waitFor(() => (logger.warn as jest.Mock).mock.calls.length >= 2);
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/^\[Redis\] connection error: /));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/^\[Redis\] connection lost; reconnecting in \d+ms$/));
    expect(client.status).not.toBe('end');
  });

  test('rejects (rather than silently drops) commands once retries are exhausted', async () => {
    client = createRedisClient(unreachableConfig, recordingLogger());

    await expect(client.get('some-key')).rejects.toThrow();
  });

  test('never logs the Redis URL or its credentials', async () => {
    const logger = recordingLogger();
    client = createRedisClient(unreachableConfig, logger);

    await waitFor(() => logger.messages.length >= 3);
    expect(logger.messages.join('\n')).not.toMatch(/topsecret|redis:\/\//);
  });
});

describe('closeRedisClient', () => {
  test('cancels further reconnection attempts for a client that cannot connect', async () => {
    const logger = recordingLogger();
    const client = createRedisClient(unreachableConfig, logger);
    await waitFor(() => (logger.warn as jest.Mock).mock.calls.length >= 1);

    await closeRedisClient(client);
    const warningsAtClose = (logger.warn as jest.Mock).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect((logger.warn as jest.Mock).mock.calls.length).toBe(warningsAtClose);
    expect(client.status).not.toBe('ready');
  });

  test('is safe to call more than once', async () => {
    const client = createRedisClient(unreachableConfig, recordingLogger());

    await closeRedisClient(client);
    await expect(closeRedisClient(client)).resolves.toBeUndefined();
  });
});
