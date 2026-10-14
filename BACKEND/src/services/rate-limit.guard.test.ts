process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';

import { Redis } from 'ioredis';
import { RATE_LIMIT_INCR_SCRIPT, RedisRateLimitGuard } from './rate-limit.guard';

/**
 * Minimal in-memory stand-in for the subset of the ioredis API the guard
 * uses (EVAL of RATE_LIMIT_INCR_SCRIPT), emulating the script's INCR/EXPIRE
 * semantics, with helpers to simulate key expiry and a TTL-less key.
 */
class FakeRedis {
  private readonly counts = new Map<string, number>();
  readonly ttls = new Map<string, number>();

  incr = jest.fn((key: string): number => {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  });

  expire = jest.fn((key: string, seconds: number): number => {
    this.ttls.set(key, seconds);
    return 1;
  });

  eval = jest.fn(async (script: string, numKeys: number, key: string, windowSeconds: number): Promise<number> => {
    expect(script).toBe(RATE_LIMIT_INCR_SCRIPT);
    expect(numKeys).toBe(1);
    const count = this.incr(key);
    if (count === 1 || !this.ttls.has(key)) {
      this.expire(key, windowSeconds);
    }
    return count;
  });

  simulateWindowExpiry(key: string): void {
    this.counts.delete(key);
    this.ttls.delete(key);
  }

  simulateMissingTtl(key: string, count: number): void {
    this.counts.set(key, count);
    this.ttls.delete(key);
  }
}

describe('RedisRateLimitGuard', () => {
  let fakeRedis: FakeRedis;
  let guard: RedisRateLimitGuard;

  beforeEach(() => {
    fakeRedis = new FakeRedis();
    guard = new RedisRateLimitGuard(fakeRedis as unknown as Redis, 5, 15);
  });

  test('allows the 5th attempt within the window', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(guard.allow('user-1')).resolves.toBe(true);
    }

    await expect(guard.allow('user-1')).resolves.toBe(true);
    expect(fakeRedis.eval).toHaveBeenCalledTimes(5);
  });

  test('rejects the 6th attempt within the window', async () => {
    for (let i = 0; i < 5; i++) {
      await guard.allow('user-1');
    }

    await expect(guard.allow('user-1')).resolves.toBe(false);
  });

  test('sets a TTL only on the first attempt in the window', async () => {
    await guard.allow('user-1');
    await guard.allow('user-1');

    expect(fakeRedis.expire).toHaveBeenCalledTimes(1);
    expect(fakeRedis.expire).toHaveBeenCalledWith('otp:rl:user-1', 15 * 60);
  });

  test('resets the counter once the window expires', async () => {
    for (let i = 0; i < 5; i++) {
      await guard.allow('user-1');
    }
    await expect(guard.allow('user-1')).resolves.toBe(false);

    fakeRedis.simulateWindowExpiry('otp:rl:user-1');

    await expect(guard.allow('user-1')).resolves.toBe(true);
  });

  test('increments and sets the TTL in a single atomic round trip', async () => {
    await guard.allow('user-1');

    expect(fakeRedis.eval).toHaveBeenCalledTimes(1);
    expect(fakeRedis.eval).toHaveBeenCalledWith(RATE_LIMIT_INCR_SCRIPT, 1, 'otp:rl:user-1', 15 * 60);
  });

  test('repairs a counter left without a TTL instead of locking the user out forever', async () => {
    fakeRedis.simulateMissingTtl('otp:rl:user-1', 3);

    await expect(guard.allow('user-1')).resolves.toBe(true);
    expect(fakeRedis.ttls.get('otp:rl:user-1')).toBe(15 * 60);
  });

  test('propagates Redis errors instead of silently allowing the attempt', async () => {
    fakeRedis.eval.mockRejectedValueOnce(new Error('Connection is closed.'));

    await expect(guard.allow('user-1')).rejects.toThrow('Connection is closed.');
  });
});
