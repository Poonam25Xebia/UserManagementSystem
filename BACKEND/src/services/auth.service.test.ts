import { DefaultAuthService } from './auth.service';
import { IUserRepository } from '../repositories/user.repository';
import { PasswordHasher } from './password-hasher';
import { LoginGuard } from './login-guard';
import { SessionService } from './session.service';
import { UserEntity } from '../types/registration.types';
import {
  InvalidCredentialsException,
  AccountNotActiveException,
  AccountLockedException,
  SessionCreationFailedException,
} from '../errors/login.errors';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    username: 'jdoe',
    usernameNormalised: 'jdoe',
    email: 'jdoe@example.test',
    passwordHash: 'stored-hash',
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

describe('DefaultAuthService', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let loginGuard: jest.Mocked<LoginGuard>;
  let sessionService: jest.Mocked<SessionService>;
  let service: DefaultAuthService;

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
    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    loginGuard = {
      checkLockout: jest.fn(),
      registerFailure: jest.fn(),
    };
    sessionService = {
      createSession: jest.fn(),
      validateSession: jest.fn(),
      invalidateSession: jest.fn(),
      invalidateAllForUser: jest.fn(),
    };
    service = new DefaultAuthService(userRepository, passwordHasher, loginGuard, sessionService);
  });

  test('unknown email raises InvalidCredentialsException without comparing a password', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(service.login('nobody@example.test', 'whatever')).rejects.toBeInstanceOf(
      InvalidCredentialsException,
    );
    expect(passwordHasher.compare).not.toHaveBeenCalled();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  test('wrong password raises InvalidCredentialsException identical to unknown-email case', async () => {
    let unknownEmailError: unknown;
    let wrongPasswordError: unknown;

    userRepository.findByEmail.mockResolvedValueOnce(null);
    try {
      await service.login('nobody@example.test', 'whatever');
    } catch (err) {
      unknownEmailError = err;
    }

    userRepository.findByEmail.mockResolvedValueOnce(buildUser());
    passwordHasher.compare.mockResolvedValueOnce(false);
    try {
      await service.login('jdoe@example.test', 'wrong-password');
    } catch (err) {
      wrongPasswordError = err;
    }

    expect(unknownEmailError).toBeInstanceOf(InvalidCredentialsException);
    expect(wrongPasswordError).toBeInstanceOf(InvalidCredentialsException);
    expect((unknownEmailError as Error).message).toBe((wrongPasswordError as Error).message);
  });

  test('wrong password registers a failure via LoginGuard before throwing', async () => {
    const user = buildUser();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(service.login('jdoe@example.test', 'wrong-password')).rejects.toBeInstanceOf(
      InvalidCredentialsException,
    );

    expect(loginGuard.registerFailure).toHaveBeenCalledWith(user);
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  test('locked account raises AccountLockedException before password comparison runs', async () => {
    const user = buildUser({ lockedUntil: new Date(Date.now() + 60_000) });
    userRepository.findByEmail.mockResolvedValue(user);
    loginGuard.checkLockout.mockImplementation(() => {
      throw new AccountLockedException(user.lockedUntil!);
    });

    await expect(service.login('jdoe@example.test', 'any-password')).rejects.toBeInstanceOf(
      AccountLockedException,
    );
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  test('inactive account raises AccountNotActiveException before password comparison runs', async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ status: 'pending' }));

    await expect(service.login('jdoe@example.test', 'any-password')).rejects.toBeInstanceOf(
      AccountNotActiveException,
    );
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  test('suspended account raises AccountNotActiveException before password comparison runs', async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ status: 'suspended' }));

    await expect(service.login('jdoe@example.test', 'any-password')).rejects.toBeInstanceOf(
      AccountNotActiveException,
    );
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  test('successful login resets failed_login_count and sets last_login_at', async () => {
    const user = buildUser({ failedLoginCount: 3 });
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);
    sessionService.createSession.mockResolvedValue({
      rawToken: 'raw-token-value',
      expiresAt: new Date('2026-01-01T01:00:00.000Z'),
    });

    const result = await service.login('jdoe@example.test', 'correct-password');

    expect(userRepository.resetFailedLoginCount).toHaveBeenCalledWith('user-1');
    expect(userRepository.updateLastLoginAt).toHaveBeenCalledWith('user-1', expect.any(Date));
    expect(result).toEqual({
      token: 'raw-token-value',
      expiresAt: new Date('2026-01-01T01:00:00.000Z'),
    });
  });

  test('session-creation failure propagates as SessionCreationFailedException without re-verifying credentials', async () => {
    const user = buildUser();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);
    sessionService.createSession.mockRejectedValue(new Error('DB unavailable'));

    await expect(service.login('jdoe@example.test', 'correct-password')).rejects.toBeInstanceOf(
      SessionCreationFailedException,
    );

    // Credential verification already happened once; a caller retrying should
    // hit login() again (a fresh call), not have this call re-verify anything.
    expect(passwordHasher.compare).toHaveBeenCalledTimes(1);
    expect(userRepository.resetFailedLoginCount).toHaveBeenCalledTimes(1);
  });
});
