import {
  buildRedisOptions,
  computeRetryDelay,
  loadRedisConfig,
  shouldReconnectOnError,
} from './redis.config';

describe('loadRedisConfig', () => {
  test('applies resilient defaults when no Redis env vars are set', () => {
    expect(loadRedisConfig({})).toEqual({
      redisUrl: 'redis://localhost:6379',
      connectionName: 'user-management-service',
      connectTimeoutMs: 10000,
      commandTimeoutMs: 5000,
      maxRetriesPerRequest: 3,
      retryBaseDelayMs: 100,
      retryMaxDelayMs: 5000,
      keepAliveMs: 30000,
    });
  });

  test('reads overrides from the environment', () => {
    const config = loadRedisConfig({
      REDIS_URL: ' rediss://cache.internal:6380 ',
      REDIS_CONNECTION_NAME: 'ums-test',
      REDIS_CONNECT_TIMEOUT_MS: '2000',
      REDIS_COMMAND_TIMEOUT_MS: '0',
      REDIS_MAX_RETRIES_PER_REQUEST: '5',
      REDIS_RETRY_BASE_DELAY_MS: '50',
      REDIS_RETRY_MAX_DELAY_MS: '1000',
      REDIS_KEEP_ALIVE_MS: '0',
    });

    expect(config).toEqual({
      redisUrl: 'rediss://cache.internal:6380',
      connectionName: 'ums-test',
      connectTimeoutMs: 2000,
      commandTimeoutMs: 0,
      maxRetriesPerRequest: 5,
      retryBaseDelayMs: 50,
      retryMaxDelayMs: 1000,
      keepAliveMs: 0,
    });
  });

  test.each([
    ['REDIS_CONNECT_TIMEOUT_MS', 'abc'],
    ['REDIS_CONNECT_TIMEOUT_MS', '0'],
    ['REDIS_COMMAND_TIMEOUT_MS', '-1'],
    ['REDIS_MAX_RETRIES_PER_REQUEST', '1.5'],
    ['REDIS_RETRY_BASE_DELAY_MS', '0'],
  ])('fails fast with a configuration error when %s=%s', (key, value) => {
    expect(() => loadRedisConfig({ [key]: value })).toThrow(/^Configuration error: /);
  });

  test('rejects a non-redis URL without echoing it (it may contain credentials)', () => {
    expect(() => loadRedisConfig({ REDIS_URL: 'http://user:secret@host' })).toThrow(
      "Configuration error: REDIS_URL must start with 'redis://' or 'rediss://'.",
    );
    expect(() => loadRedisConfig({ REDIS_URL: 'http://user:secret@host' })).not.toThrow(/secret/);
  });

  test('rejects a max retry delay smaller than the base delay', () => {
    expect(() =>
      loadRedisConfig({ REDIS_RETRY_BASE_DELAY_MS: '500', REDIS_RETRY_MAX_DELAY_MS: '100' }),
    ).toThrow(/REDIS_RETRY_MAX_DELAY_MS/);
  });
});

describe('computeRetryDelay', () => {
  const config = loadRedisConfig({ REDIS_RETRY_BASE_DELAY_MS: '100', REDIS_RETRY_MAX_DELAY_MS: '1000' });

  test('backs off exponentially and caps at the max delay', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => computeRetryDelay(n, config))).toEqual([
      100, 200, 400, 800, 1000, 1000,
    ]);
  });

  test('never gives up reconnecting, even after many attempts', () => {
    expect(computeRetryDelay(10_000, config)).toBe(1000);
  });
});

describe('shouldReconnectOnError', () => {
  test('reconnects and resends the command after a READONLY (failover) error', () => {
    expect(shouldReconnectOnError(new Error("READONLY You can't write against a read only replica."))).toBe(2);
  });

  test('does not reconnect on ordinary command errors', () => {
    expect(shouldReconnectOnError(new Error('WRONGTYPE Operation against a key'))).toBe(false);
  });
});

describe('buildRedisOptions', () => {
  test('maps config to ioredis options with offline queueing and auto-resend enabled', () => {
    const config = loadRedisConfig({});
    const options = buildRedisOptions(config);

    expect(options).toMatchObject({
      connectionName: 'user-management-service',
      connectTimeout: 10000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 3,
      keepAlive: 30000,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
    });
    expect(options.retryStrategy?.(3)).toBe(400);
    expect(options.reconnectOnError).toBe(shouldReconnectOnError);
  });

  test('omits the command timeout when disabled', () => {
    const options = buildRedisOptions(loadRedisConfig({ REDIS_COMMAND_TIMEOUT_MS: '0' }));
    expect(options.commandTimeout).toBeUndefined();
  });
});
