/**
 * login-guard.ts
 *
 * Isolated account-lockout policy, independently testable and configurable
 * from the rest of AuthService.login().
 *
 * Requirements: US-036 FR-007–009; US-039 FR-007–009
 * [NEEDS CLARIFICATION: exact threshold/duration to be confirmed by product —
 * see .kiro/specs/user_login/design.md Requirements Reconciliation #4. Both
 * values are config-driven (lockoutConfig) so the assumption is cheap to
 * change without a code change.]
 */

import { IUserRepository } from '../repositories/user.repository';
import { UserEntity } from '../types/registration.types';
import { AccountLockedException } from '../errors/login.errors';
import { lockoutConfig } from '../config/lockout.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface LoginGuard {
  /** Throws AccountLockedException if the user's lockout window is still active. */
  checkLockout(user: UserEntity): void;
  /** Increments the failure counter; locks the account once the threshold is reached. */
  registerFailure(user: UserEntity): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultLoginGuard implements LoginGuard {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly threshold: number = lockoutConfig.loginLockoutThreshold,
    private readonly lockoutMinutes: number = lockoutConfig.loginLockoutDurationMinutes,
  ) {}

  /**
   * Throws only while `lockedUntil` is strictly in the future — a
   * `lockedUntil` in the past (or null) means the account is not currently
   * locked, regardless of how it got there.
   */
  checkLockout(user: UserEntity): void {
    if (user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now()) {
      throw new AccountLockedException(user.lockedUntil);
    }
  }

  /**
   * Always increments the failure counter by 1 first. If the incremented
   * count reaches the configured threshold, applies a lockout and resets the
   * counter to 0 in the same call, so the next window starts clean.
   */
  async registerFailure(user: UserEntity): Promise<void> {
    await this.userRepository.incrementFailedLoginCount(user.id);

    const nextCount = user.failedLoginCount + 1;
    if (nextCount >= this.threshold) {
      const lockedUntil = new Date(Date.now() + this.lockoutMinutes * 60 * 1000);
      await this.userRepository.lockAccount(user.id, lockedUntil);
      await this.userRepository.resetFailedLoginCount(user.id);
    }
  }
}
