process.env.ACTIVATION_BASE_URL = 'https://app.example.test';
process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.PASSWORD_RECOVERY_BASE_URL = 'https://app.example.test';
process.env.PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID = 'd-test-recovery-template';

import { Pool, PoolClient } from 'pg';
import { DefaultPasswordRecoveryService } from './password-recovery.service';
import { IUserRepository } from '../repositories/user.repository';
import { IPasswordRecoveryRequestRepository } from '../repositories/password-recovery-request.repository';
import { PasswordPolicyEvaluator } from '../validators/password-policy.evaluator';
import { PasswordHasher } from './password-hasher';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { UserEntity } from '../types/registration.types';
import { PasswordRecoveryRequestEntity } from '../types/login.types';
import {
  TokenNotFoundException,
  TokenExpiredException,
  PasswordPolicyViolationException,
} from '../errors/login.errors';

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    username: 'jdoe',
    usernameNormalised: 'jdoe',
    email: 'jdoe@example.test',
    passwordHash: 'old-hash',
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

function buildRequest(overrides: Partial<PasswordRecoveryRequestEntity> = {}): PasswordRecoveryRequestEntity {
  return {
    id: 'request-1',
    userId: 'user-1',
    token: 'raw-recovery-token',
    requestedAt: new Date(Date.now() - 1000),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    consumed: false,
    consumedAt: null,
    ...overrides,
  };
}

describe('DefaultPasswordRecoveryService', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let recoveryRequestRepository: jest.Mocked<IPasswordRecoveryRequestRepository>;
  let passwordPolicyEvaluator: jest.Mocked<PasswordPolicyEvaluator>;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let notificationPort: jest.Mocked<EmailDeliveryPort>;
  let mockClient: jest.Mocked<PoolClient>;
  let pool: jest.Mocked<Pool>;
  let service: DefaultPasswordRecoveryService;

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
    recoveryRequestRepository = {
      insert: jest.fn(),
      findByToken: jest.fn(),
      markConsumed: jest.fn(),
    };
    passwordPolicyEvaluator = { evaluate: jest.fn() };
    passwordHasher = { hash: jest.fn(), compare: jest.fn() };
    notificationPort = { sendTransactional: jest.fn() };

    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    } as unknown as jest.Mocked<PoolClient>;

    pool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    } as unknown as jest.Mocked<Pool>;

    service = new DefaultPasswordRecoveryService(
      userRepository,
      recoveryRequestRepository,
      passwordPolicyEvaluator,
      passwordHasher,
      notificationPort,
      pool,
    );
  });

  describe('requestRecovery', () => {
    test('unknown email produces zero DB writes and zero notification calls', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await service.requestRecovery('unknown@example.test');

      expect(recoveryRequestRepository.insert).not.toHaveBeenCalled();
      expect(notificationPort.sendTransactional).not.toHaveBeenCalled();
    });

    test('unknown email does not throw', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.requestRecovery('unknown@example.test')).resolves.toBeUndefined();
    });

    test('known email creates a recovery request and dispatches a notification', async () => {
      const user = buildUser();
      userRepository.findByEmail.mockResolvedValue(user);
      recoveryRequestRepository.insert.mockResolvedValue(buildRequest());

      await service.requestRecovery('jdoe@example.test');

      expect(recoveryRequestRepository.insert).toHaveBeenCalledTimes(1);
      const [userId, token, , expiresAt] = recoveryRequestRepository.insert.mock.calls[0];
      expect(userId).toBe(user.id);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(notificationPort.sendTransactional).toHaveBeenCalledTimes(1);
      const [recipient] = notificationPort.sendTransactional.mock.calls[0];
      expect(recipient).toEqual({ address: user.email, name: user.username });
    });
  });

  describe('resetPassword', () => {
    test('token not found -> TokenNotFoundException', async () => {
      recoveryRequestRepository.findByToken.mockResolvedValue(null);

      await expect(service.resetPassword('unknown-token', 'NewP@ss1')).rejects.toBeInstanceOf(
        TokenNotFoundException,
      );
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('expired token -> TokenExpiredException (410, not 400)', async () => {
      recoveryRequestRepository.findByToken.mockResolvedValue(
        buildRequest({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.resetPassword('expired-token', 'NewP@ss1')).rejects.toBeInstanceOf(
        TokenExpiredException,
      );
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('already-consumed token -> TokenExpiredException', async () => {
      recoveryRequestRepository.findByToken.mockResolvedValue(buildRequest({ consumed: true }));

      await expect(service.resetPassword('consumed-token', 'NewP@ss1')).rejects.toBeInstanceOf(
        TokenExpiredException,
      );
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('policy-violating password -> PasswordPolicyViolationException, no DB write', async () => {
      recoveryRequestRepository.findByToken.mockResolvedValue(buildRequest());
      passwordPolicyEvaluator.evaluate.mockReturnValue({
        valid: false,
        violations: ['Password must be at least 8 characters.'],
      });

      await expect(service.resetPassword('valid-token', 'weak')).rejects.toBeInstanceOf(
        PasswordPolicyViolationException,
      );
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('successful reset updates password hash, marks token consumed, and invalidates all sessions atomically', async () => {
      const request = buildRequest({ userId: 'user-42', id: 'request-42' });
      recoveryRequestRepository.findByToken.mockResolvedValue(request);
      passwordPolicyEvaluator.evaluate.mockReturnValue({ valid: true, violations: [] });
      passwordHasher.hash.mockResolvedValue('new-hash-value');

      await service.resetPassword('valid-token', 'NewP@ss1');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password_hash'),
        ['new-hash-value', 'user-42'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_recovery_requests SET consumed'),
        expect.arrayContaining([expect.any(Date), 'request-42']),
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET invalidated'),
        expect.arrayContaining([expect.any(Date), 'user-42']),
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    test('mid-transaction failure rolls back and leaves no partial state', async () => {
      const request = buildRequest();
      recoveryRequestRepository.findByToken.mockResolvedValue(request);
      passwordPolicyEvaluator.evaluate.mockReturnValue({ valid: true, violations: [] });
      passwordHasher.hash.mockResolvedValue('new-hash-value');

      mockClient.query = jest
        .fn()
        .mockImplementationOnce(async () => ({ rows: [] })) // BEGIN
        .mockImplementationOnce(async () => ({ rows: [] })) // UPDATE users
        .mockImplementationOnce(async () => {
          throw new Error('DB write failed');
        }); // UPDATE password_recovery_requests fails

      await expect(service.resetPassword('valid-token', 'NewP@ss1')).rejects.toThrow(
        'DB write failed',
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});
