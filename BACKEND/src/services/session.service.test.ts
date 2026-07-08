import crypto from 'crypto';
import { DefaultSessionService } from './session.service';
import { ISessionRepository } from '../repositories/session.repository';
import { IUserRepository } from '../repositories/user.repository';
import { SessionEntity } from '../types/login.types';
import { UserEntity } from '../types/registration.types';

function buildSession(overrides: Partial<SessionEntity> = {}): SessionEntity {
  return {
    id: 'session-1',
    userId: 'user-1',
    tokenHash: 'irrelevant-hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-01T01:00:00.000Z'),
    invalidated: false,
    invalidatedAt: null,
    ...overrides,
  };
}

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

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('DefaultSessionService', () => {
  let sessionRepository: jest.Mocked<ISessionRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let service: DefaultSessionService;

  beforeEach(() => {
    sessionRepository = {
      insert: jest.fn(),
      findByTokenHash: jest.fn(),
      markInvalidated: jest.fn(),
      invalidateAllForUser: jest.fn(),
      countActiveForUser: jest.fn(),
    };
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
    service = new DefaultSessionService(sessionRepository, userRepository, 3600);
  });

  describe('createSession', () => {
    test('persists only the SHA-256 hash of the raw token', async () => {
      sessionRepository.insert.mockImplementation(async (userId, tokenHash, createdAt, expiresAt) =>
        buildSession({ userId, tokenHash, createdAt, expiresAt }),
      );

      const { rawToken } = await service.createSession('user-1');

      expect(sessionRepository.insert).toHaveBeenCalledTimes(1);
      const [, persistedHash] = sessionRepository.insert.mock.calls[0];
      expect(persistedHash).toBe(sha256(rawToken));
      expect(persistedHash).not.toBe(rawToken);
    });

    test('sets expiresAt = createdAt + sessionExpirySeconds', async () => {
      sessionRepository.insert.mockImplementation(async (userId, tokenHash, createdAt, expiresAt) =>
        buildSession({ userId, tokenHash, createdAt, expiresAt }),
      );

      const before = Date.now();
      const { expiresAt } = await service.createSession('user-1');
      const after = Date.now();

      // expiresAt should be ~3600s after "now" at time of call, within the
      // window bounded by before/after to avoid flakiness on slow CI.
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 3600 * 1000);
    });

    test('generates a unique raw token per call', async () => {
      sessionRepository.insert.mockImplementation(async (userId, tokenHash, createdAt, expiresAt) =>
        buildSession({ userId, tokenHash, createdAt, expiresAt }),
      );

      const first = await service.createSession('user-1');
      const second = await service.createSession('user-1');

      expect(first.rawToken).not.toBe(second.rawToken);
    });
  });

  describe('validateSession', () => {
    test('returns NOT_FOUND when no session matches the token hash', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(null);

      const result = await service.validateSession('some-raw-token');

      expect(result).toEqual({ valid: false, reason: 'NOT_FOUND' });
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    test('returns EXPIRED when expiresAt is in the past', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(
        buildSession({ expiresAt: new Date(Date.now() - 1000) }),
      );

      const result = await service.validateSession('some-raw-token');

      expect(result).toEqual({ valid: false, reason: 'EXPIRED' });
    });

    test('treats expiresAt === now as expired (boundary)', async () => {
      const now = new Date('2026-03-01T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      sessionRepository.findByTokenHash.mockResolvedValue(buildSession({ expiresAt: now }));

      try {
        const result = await service.validateSession('some-raw-token');
        expect(result).toEqual({ valid: false, reason: 'EXPIRED' });
      } finally {
        jest.useRealTimers();
      }
    });

    test('returns INVALIDATED when the session has been invalidated', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(
        buildSession({
          invalidated: true,
          expiresAt: new Date(Date.now() + 1000 * 60),
        }),
      );

      const result = await service.validateSession('some-raw-token');

      expect(result).toEqual({ valid: false, reason: 'INVALIDATED' });
    });

    test('returns valid: true for an active, unexpired, non-invalidated session', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(
        buildSession({
          userId: 'user-42',
          expiresAt: new Date(Date.now() + 1000 * 60),
        }),
      );
      userRepository.findById.mockResolvedValue(buildUser({ id: 'user-42', status: 'active' }));

      const result = await service.validateSession('some-raw-token');

      expect(result).toEqual({ valid: true, userId: 'user-42' });
    });

    test('cascades invalidation to all sessions when the owning user is suspended (EC-003)', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(
        buildSession({
          userId: 'user-42',
          expiresAt: new Date(Date.now() + 1000 * 60),
        }),
      );
      userRepository.findById.mockResolvedValue(buildUser({ id: 'user-42', status: 'suspended' }));

      const result = await service.validateSession('some-raw-token');

      expect(result).toEqual({ valid: false, reason: 'ACCOUNT_SUSPENDED' });
      expect(sessionRepository.invalidateAllForUser).toHaveBeenCalledWith('user-42');
    });
  });

  describe('invalidateSession (logout)', () => {
    test('is idempotent: not-found token is treated as already terminated (EC-005)', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(null);

      const result = await service.invalidateSession('unknown-token');

      expect(result).toEqual({ alreadyTerminated: true });
      expect(sessionRepository.markInvalidated).not.toHaveBeenCalled();
    });

    test('is idempotent: already-invalidated token is treated as already terminated', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(
        buildSession({ invalidated: true, expiresAt: new Date(Date.now() + 60_000) }),
      );

      const result = await service.invalidateSession('some-token');

      expect(result).toEqual({ alreadyTerminated: true });
      expect(sessionRepository.markInvalidated).not.toHaveBeenCalled();
    });

    test('is idempotent: expired token is treated as already terminated', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(
        buildSession({ expiresAt: new Date(Date.now() - 1000) }),
      );

      const result = await service.invalidateSession('some-token');

      expect(result).toEqual({ alreadyTerminated: true });
      expect(sessionRepository.markInvalidated).not.toHaveBeenCalled();
    });

    test('marks an active session as invalidated', async () => {
      sessionRepository.findByTokenHash.mockResolvedValue(
        buildSession({ id: 'session-99', expiresAt: new Date(Date.now() + 60_000) }),
      );

      const result = await service.invalidateSession('some-token');

      expect(result).toEqual({ alreadyTerminated: false });
      expect(sessionRepository.markInvalidated).toHaveBeenCalledWith('session-99', expect.any(Date));
    });
  });

  describe('invalidateAllForUser', () => {
    test('delegates directly to the repository for the given user only', async () => {
      await service.invalidateAllForUser('user-7');

      expect(sessionRepository.invalidateAllForUser).toHaveBeenCalledTimes(1);
      expect(sessionRepository.invalidateAllForUser).toHaveBeenCalledWith('user-7');
    });
  });
});
