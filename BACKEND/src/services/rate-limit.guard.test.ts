process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';

import { Redis } from 'ioredis';
import { RedisRateLimitGuard } from './rate-limit.guard';

/**
 * Minimal in-memory stand-in for the subset of the ioredis API the guard
 * uses (INCR / EXPIRE), with a helper to simulate the counter key expiring.
 */
class FakeRedis {
  private readonly counts = new Map<string, number>();

  incr = jest.fn(async (key: string): Promise<number> => {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  });

  expire = jest.fn(async (): Promise<number> => 1);

  simulateWindowExpiry(key: string): void {
    this.counts.delete(key);
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
    expect(fakeRedis.incr).toHaveBeenCalledTimes(5);
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
});
