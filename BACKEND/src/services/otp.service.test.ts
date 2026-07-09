process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';

import crypto from 'crypto';
import { DefaultOtpService } from './otp.service';
import { IUserRepository } from '../repositories/user.repository';
import { IOtpRequestRepository, OtpRequestRepository } from '../repositories/otp-request.repository';
import { RateLimitGuard } from './rate-limit.guard';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import {
  OtpForbiddenError,
  OtpRateLimitExceededError,
  OtpNotFoundError,
  OtpExpiredError,
  OtpInvalidError,
} from '../errors/otp.errors';
import { UserEntity } from '../types/registration.types';
import { OtpRequestEntity } from '../types/otp.types';
import { otpConfig } from '../config/otp.config';

function buildOtpRequest(overrides: Partial<OtpRequestEntity> = {}): OtpRequestEntity {
  const createdAt = new Date();
  return {
    id: 'otp-1',
    userId: 'user-1',
    emailAddress: 'jdoe@example.test',
    codeHash: crypto
      .createHmac(otpConfig.otpHashAlgorithm, otpConfig.otpHashSecret)
      .update('654321')
      .digest('hex'),
    status: 'delivered',
    createdAt,
    expiresAt: new Date(createdAt.getTime() + otpConfig.otpTtlMinutes * 60 * 1000),
    invalidatedAt: null,
    attemptSequence: 1,
    ...overrides,
  };
}

function buildMockDb() {
  const run = jest.fn();
  const prepare = jest.fn().mockReturnValue({ run, get: jest.fn(), all: jest.fn() });
  const transaction = jest.fn((fn: () => unknown) => () => fn());
  const db = { prepare, transaction } as unknown as ConstructorParameters<
    typeof OtpRequestRepository
  >[0];
  return { db, prepare, run, transaction };
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

describe('DefaultOtpService', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let otpRequestRepository: jest.Mocked<IOtpRequestRepository>;
  let rateLimitGuard: jest.Mocked<RateLimitGuard>;
  let otpDeliveryPort: jest.Mocked<OtpDeliveryPort>;
  let mockDb: ReturnType<typeof buildMockDb>;
  let service: DefaultOtpService;

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
    otpRequestRepository = {
      create: jest.fn(async (record) => ({ id: 'otp-1', ...record })),
      findActiveByUserId: jest.fn(),
      invalidateActiveByUserId: jest.fn(),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
      findById: jest.fn(),
      getNextAttemptSequence: jest.fn().mockResolvedValue(1),
    };
    rateLimitGuard = { allow: jest.fn().mockResolvedValue(true) };
    otpDeliveryPort = { dispatch: jest.fn().mockResolvedValue(true) };
    mockDb = buildMockDb();

    service = new DefaultOtpService(
      userRepository,
      otpRequestRepository,
      rateLimitGuard,
      otpDeliveryPort,
      mockDb.db,
    );
  });

  test('generates a 6-digit numeric OTP', async () => {
    userRepository.findById.mockResolvedValue(buildUser());

    await service.sendOtp('user-1');

    const [, code] = otpDeliveryPort.dispatch.mock.calls[0];
    expect(code).toMatch(/^\d{6}$/);
  });

  test('stores the OTP as a keyed hash, never plaintext', async () => {
    userRepository.findById.mockResolvedValue(buildUser());

    await service.sendOtp('user-1');

    const [, code] = otpDeliveryPort.dispatch.mock.calls[0];
    const createCall = otpRequestRepository.create.mock.calls[0][0];

    expect(createCall.codeHash).not.toBe(code);
    const expectedHash = crypto
      .createHmac(otpConfig.otpHashAlgorithm, otpConfig.otpHashSecret)
      .update(code)
      .digest('hex');
    expect(createCall.codeHash).toBe(expectedHash);
  });

  test('sets expiry to OTP_TTL_MINUTES after creation', async () => {
    userRepository.findById.mockResolvedValue(buildUser());

    await service.sendOtp('user-1');

    const createCall = otpRequestRepository.create.mock.calls[0][0];
    const diffMs = createCall.expiresAt.getTime() - createCall.createdAt.getTime();
    expect(diffMs).toBe(otpConfig.otpTtlMinutes * 60 * 1000);
  });

  test('invalidates any existing active OTP before issuing a new one', async () => {
    userRepository.findById.mockResolvedValue(buildUser());

    await service.sendOtp('user-1');

    expect(otpRequestRepository.invalidateActiveByUserId).toHaveBeenCalledWith('user-1');
    expect(otpRequestRepository.invalidateActiveByUserId.mock.invocationCallOrder[0]).toBeLessThan(
      otpRequestRepository.create.mock.invocationCallOrder[0],
    );
  });

  test.each(['suspended', 'deleted'] as const)(
    'rejects %s accounts with OtpForbiddenError',
    async (status) => {
      userRepository.findById.mockResolvedValue(buildUser({ status }));

      await expect(service.sendOtp('user-1')).rejects.toBeInstanceOf(OtpForbiddenError);
      expect(otpRequestRepository.create).not.toHaveBeenCalled();
    },
  );

  test('allows pending accounts to receive an OTP (post-registration activation)', async () => {
    userRepository.findById.mockResolvedValue(buildUser({ status: 'pending' }));

    const result = await service.sendOtp('user-1');

    expect(result).toEqual({ accepted: true, status: 'delivered' });
    expect(otpRequestRepository.create).toHaveBeenCalled();
  });

  test('returns an accepted result for unknown users without disclosure', async () => {
    userRepository.findById.mockResolvedValue(null);

    const result = await service.sendOtp('unknown-user');

    expect(result).toEqual({ accepted: true, status: 'delivered' });
    expect(rateLimitGuard.allow).not.toHaveBeenCalled();
    expect(otpRequestRepository.create).not.toHaveBeenCalled();
  });

  test('throws OtpRateLimitExceededError when the guard denies the attempt', async () => {
    userRepository.findById.mockResolvedValue(buildUser());
    rateLimitGuard.allow.mockResolvedValue(false);

    await expect(service.sendOtp('user-1')).rejects.toBeInstanceOf(OtpRateLimitExceededError);
    expect(otpRequestRepository.create).not.toHaveBeenCalled();
  });

  test('records status as failed when dispatch fails, but still reports accepted', async () => {
    userRepository.findById.mockResolvedValue(buildUser());
    otpDeliveryPort.dispatch.mockResolvedValue(false);

    const result = await service.resendOtp('user-1');

    expect(result).toEqual({ accepted: true, status: 'failed' });
    expect(otpRequestRepository.markFailed).toHaveBeenCalledWith('otp-1');
    expect(otpRequestRepository.markDelivered).not.toHaveBeenCalled();
  });

  test('records status as delivered when dispatch succeeds', async () => {
    userRepository.findById.mockResolvedValue(buildUser());

    const result = await service.sendOtp('user-1');

    expect(result).toEqual({ accepted: true, status: 'delivered' });
    expect(otpRequestRepository.markDelivered).toHaveBeenCalledWith('otp-1');
  });

  describe('verifyOtp', () => {
    test('activates the account and consumes the OTP on a correct code', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ status: 'pending' }));
      otpRequestRepository.findActiveByUserId.mockResolvedValue(buildOtpRequest());

      const result = await service.verifyOtp('user-1', '654321');

      expect(result.userId).toBe('user-1');
      expect(result.activatedAt).toBeInstanceOf(Date);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SET status = 'active'"));
      expect(mockDb.run).toHaveBeenCalledWith(result.activatedAt.toISOString(), 'user-1');
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SET invalidated_at'));
      expect(mockDb.run).toHaveBeenCalledWith(result.activatedAt.toISOString(), 'otp-1');
    });

    test('throws OtpNotFoundError when no active OTP exists', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ status: 'pending' }));
      otpRequestRepository.findActiveByUserId.mockResolvedValue(null);

      await expect(service.verifyOtp('user-1', '654321')).rejects.toBeInstanceOf(OtpNotFoundError);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    test('throws OtpNotFoundError when the user does not exist or is not pending/active', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.verifyOtp('user-1', '654321')).rejects.toBeInstanceOf(OtpNotFoundError);
      expect(otpRequestRepository.findActiveByUserId).not.toHaveBeenCalled();
    });

    test('throws OtpExpiredError when the OTP has expired', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ status: 'pending' }));
      otpRequestRepository.findActiveByUserId.mockResolvedValue(
        buildOtpRequest({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.verifyOtp('user-1', '654321')).rejects.toBeInstanceOf(OtpExpiredError);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    test('throws OtpInvalidError when the code does not match', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ status: 'pending' }));
      otpRequestRepository.findActiveByUserId.mockResolvedValue(buildOtpRequest());

      await expect(service.verifyOtp('user-1', '000000')).rejects.toBeInstanceOf(OtpInvalidError);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });
});
