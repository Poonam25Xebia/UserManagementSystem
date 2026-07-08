/**
 * rate-limit.guard.ts
 *
 * Redis-backed rolling-window rate limit guard for OTP send/resend requests.
 * Uses key pattern `otp:rl:{user_id}` with a TTL equal to the configured
 * rate-limit window, so the counter resets automatically once the window
 * elapses.
 *
 * Requirements: US-002 FR-008
 */

import { Redis } from 'ioredis';
import { otpConfig } from '../config/otp.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RateLimitGuard {
  allow(userId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class RedisRateLimitGuard implements RateLimitGuard {
  constructor(
    private readonly redis: Redis,
    private readonly maxAttemptsPerWindow: number = otpConfig.otpMaxAttemptsPerWindow,
    private readonly windowMinutes: number = otpConfig.otpRateLimitWindowMinutes,
  ) {}

  /**
   * Increment the rolling counter for a user and report whether this attempt
   * is within the allowed window quota.
   *
   * The first increment in a window sets the key's TTL; subsequent increments
   * within the window leave the TTL untouched so the window keeps rolling
   * from the first attempt, not each subsequent one.
   */
  async allow(userId: string): Promise<boolean> {
    const key = `otp:rl:${userId}`;
    const windowSeconds = this.windowMinutes * 60;

    const attemptCount = await this.redis.incr(key);

    if (attemptCount === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    return attemptCount <= this.maxAttemptsPerWindow;
  }
}
