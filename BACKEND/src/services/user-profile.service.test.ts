import { DefaultUserProfileService } from './user-profile.service';
import { IUserRepository } from '../repositories/user.repository';
import { ISessionRepository } from '../repositories/session.repository';
import { UserEntity } from '../types/registration.types';
import { UserNotFoundException } from '../errors/registration.errors';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    username: 'jdoe',
    usernameNormalised: 'jdoe',
    email: 'jdoe@example.test',
    passwordHash: 'irrelevant-hash',
    status: 'active',
    registrationTimestamp: new Date('2026-01-01T00:00:00.000Z'),
    activatedAt: new Date('2026-01-01T00:05:00.000Z'),
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: new Date('2026-01-02T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('DefaultUserProfileService', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let sessionRepository: jest.Mocked<ISessionRepository>;
  let service: DefaultUserProfileService;

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
    sessionRepository = {
      insert: jest.fn(),
      findByTokenHash: jest.fn(),
      markInvalidated: jest.fn(),
      invalidateAllForUser: jest.fn(),
      countActiveForUser: jest.fn(),
    };
    service = new DefaultUserProfileService(userRepository, sessionRepository);
  });

  test('throws UserNotFoundException when the user is missing', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(service.getProfile('missing-user')).rejects.toThrow(UserNotFoundException);
    expect(sessionRepository.countActiveForUser).not.toHaveBeenCalled();
  });

  test('returns the user profile with the active session count', async () => {
    const user = buildUser();
    userRepository.findById.mockResolvedValue(user);
    sessionRepository.countActiveForUser.mockResolvedValue(3);

    const result = await service.getProfile('user-1');

    expect(result).toEqual({
      username: user.username,
      email: user.email,
      status: user.status,
      registrationTimestamp: user.registrationTimestamp,
      lastLoginAt: user.lastLoginAt,
      activeSessions: 3,
    });
    expect(sessionRepository.countActiveForUser).toHaveBeenCalledWith('user-1');
  });

  test('returns lastLoginAt as null when the user has never logged in', async () => {
    userRepository.findById.mockResolvedValue(buildUser({ lastLoginAt: null }));
    sessionRepository.countActiveForUser.mockResolvedValue(0);

    const result = await service.getProfile('user-1');

    expect(result.lastLoginAt).toBeNull();
    expect(result.activeSessions).toBe(0);
  });
});
