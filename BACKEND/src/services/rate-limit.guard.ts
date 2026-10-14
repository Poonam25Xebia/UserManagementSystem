/**
 * rate-limit.guard.ts
 *
 * Redis-backed rolling-window rate limit guard for OTP send/resend requests.
 * Uses key pattern `otp:rl:{user_id}` with a TTL equal to the configured
 * rate-limit window, so the counter resets automatically once the window
 * elapses.
 *
 * INCR and EXPIRE run atomically in one Lua script, so a connection drop
 * between them can never leave a counter without a TTL (which would lock the
 * user out permanently). Counters found without a TTL are repaired.
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

export const RATE_LIMIT_INCR_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('TTL', KEYS[1]) == -1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

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

    const attemptCount = Number(
      await this.redis.eval(RATE_LIMIT_INCR_SCRIPT, 1, key, windowSeconds),
    );

    return attemptCount <= this.maxAttemptsPerWindow;
  }
}
