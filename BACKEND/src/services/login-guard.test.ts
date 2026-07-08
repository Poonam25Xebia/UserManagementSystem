import { DefaultLoginGuard } from './login-guard';
import { IUserRepository } from '../repositories/user.repository';
import { UserEntity } from '../types/registration.types';
import { AccountLockedException } from '../errors/login.errors';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    username: 'jdoe',
    usernameNormalised: 'jdoe',
    email: 'jdoe@example.test',
    passwordHash: 'irrelevant-hash',
    status: 'active',
    registrationTimestamp: new Date(),
    activatedAt: new Date(),
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('DefaultLoginGuard', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let guard: DefaultLoginGuard;

  beforeEach(() => {
    userRepository = {
      insert: jest.fn(),
      findByNormalisedUsername: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      findByEmail: jest.fn(),
      incrementFailedLoginCount: jest.fn(),
      resetFailedLoginCount: jest.fn(),
      lockAccount: jest.fn(),
      updateLastLoginAt: jest.fn(),
      updatePasswordHash: jest.fn(),
      anonymizeAndMarkDeleted: jest.fn(),
    };
    // threshold=5, lockoutMinutes=15 (defaults), passed explicitly for clarity
    guard = new DefaultLoginGuard(userRepository, 5, 15);
  });

  describe('checkLockout', () => {
    test('does not throw when lockedUntil is null', () => {
      expect(() => guard.checkLockout(buildUser({ lockedUntil: null }))).not.toThrow();
    });

    test('does not throw when lockedUntil is in the past', () => {
      const past = new Date(Date.now() - 1000);
      expect(() => guard.checkLockout(buildUser({ lockedUntil: past }))).not.toThrow();
    });

    test('throws AccountLockedException when lockedUntil is strictly in the future', () => {
      const future = new Date(Date.now() + 60_000);
      expect(() => guard.checkLockout(buildUser({ lockedUntil: future }))).toThrow(
        AccountLockedException,
      );
    });

    test('AccountLockedException carries the retryAfter timestamp', () => {
      expect.assertions(2);
      const future = new Date(Date.now() + 60_000);

      try {
        guard.checkLockout(buildUser({ lockedUntil: future }));
      } catch (err) {
        expect(err).toBeInstanceOf(AccountLockedException);
        expect((err as AccountLockedException).retryAfter).toBe(future);
      }
    });
  });

  describe('registerFailure', () => {
    test('increments the failure counter by exactly 1 per call', async () => {
      await guard.registerFailure(buildUser({ failedLoginCount: 0 }));

      expect(userRepository.incrementFailedLoginCount).toHaveBeenCalledTimes(1);
      expect(userRepository.incrementFailedLoginCount).toHaveBeenCalledWith('user-1');
    });

    test('does not lock the account before the threshold is reached', async () => {
      await guard.registerFailure(buildUser({ failedLoginCount: 3 })); // -> would become 4, threshold is 5

      expect(userRepository.lockAccount).not.toHaveBeenCalled();
      expect(userRepository.resetFailedLoginCount).not.toHaveBeenCalled();
    });

    test('locks the account exactly when the threshold is reached', async () => {
      await guard.registerFailure(buildUser({ failedLoginCount: 4 })); // -> becomes 5, threshold is 5

      expect(userRepository.lockAccount).toHaveBeenCalledTimes(1);
      const [userId, lockedUntil] = userRepository.lockAccount.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(lockedUntil.getTime()).toBeGreaterThan(Date.now());
    });

    test('does not lock again beyond the threshold (still locks, since caller only calls on failures)', async () => {
      // If somehow called again above threshold, it still locks — the guard
      // does not special-case "already past threshold" differently.
      await guard.registerFailure(buildUser({ failedLoginCount: 10 }));

      expect(userRepository.lockAccount).toHaveBeenCalledTimes(1);
    });

    test('resets the counter to 0 in the same call that trips the lock', async () => {
      await guard.registerFailure(buildUser({ failedLoginCount: 4 }));

      expect(userRepository.resetFailedLoginCount).toHaveBeenCalledTimes(1);
      expect(userRepository.resetFailedLoginCount).toHaveBeenCalledWith('user-1');
    });

    test('sets lockedUntil approximately lockoutMinutes from now', async () => {
      const before = Date.now();
      await guard.registerFailure(buildUser({ failedLoginCount: 4 }));
      const after = Date.now();

      const [, lockedUntil] = userRepository.lockAccount.mock.calls[0];
      expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
      expect(lockedUntil.getTime()).toBeLessThanOrEqual(after + 15 * 60 * 1000);
    });
  });
});
