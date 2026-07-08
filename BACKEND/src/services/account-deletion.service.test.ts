process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
process.env.ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID = 'd-test-deletion-request-template';
process.env.ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID = 'd-test-deletion-notice-template';

import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { DefaultAccountDeletionService } from './account-deletion.service';
import { IUserRepository } from '../repositories/user.repository';
import { IDeletionRequestRepository } from '../repositories/deletion-request.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { UserEntity } from '../types/registration.types';
import { DeletionRequestEntity } from '../types/account-deletion.types';
import {
  DeletionRequestAlreadyPendingException,
  DeletionRequestNotFoundException,
  DeletionOtpExpiredException,
  DeletionOtpInvalidException,
  AccountNotActiveException,
} from '../errors/account-deletion.errors';

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

function hashTestCode(code: string): string {
  return crypto.createHmac('sha256', 'test-otp-secret').update(code).digest('hex');
}

function buildRequest(overrides: Partial<DeletionRequestEntity> = {}): DeletionRequestEntity {
  return {
    id: 'request-1',
    userId: 'user-1',
    codeHash: 'fixed-code-hash',
    issuedAt: new Date(Date.now() - 1000),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    status: 'pending',
    confirmedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe('DefaultAccountDeletionService', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let deletionRequestRepository: jest.Mocked<IDeletionRequestRepository>;
  let notificationPort: jest.Mocked<EmailDeliveryPort>;
  let mockClient: jest.Mocked<PoolClient>;
  let pool: jest.Mocked<Pool>;
  let service: DefaultAccountDeletionService;

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
    deletionRequestRepository = {
      insert: jest.fn(),
      findPendingByUserId: jest.fn(),
      updateStatus: jest.fn(),
    };
    notificationPort = {
      sendTransactional: jest.fn().mockResolvedValue({ success: true }),
    };
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    } as unknown as jest.Mocked<PoolClient>;
    pool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    } as unknown as jest.Mocked<Pool>;

    service = new DefaultAccountDeletionService(
      userRepository,
      deletionRequestRepository,
      notificationPort,
      pool,
    );
  });

  describe('requestDeletion', () => {
    test('throws AccountNotActiveException when the account is missing', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.requestDeletion('missing-user')).rejects.toThrow(
        AccountNotActiveException,
      );
      expect(deletionRequestRepository.insert).not.toHaveBeenCalled();
    });

    test('throws AccountNotActiveException when the account is not active', async () => {
      userRepository.findById.mockResolvedValue(buildUser({ status: 'pending' }));

      await expect(service.requestDeletion('user-1')).rejects.toThrow(AccountNotActiveException);
      expect(deletionRequestRepository.insert).not.toHaveBeenCalled();
    });

    test('throws DeletionRequestAlreadyPendingException when a pending request already exists', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(buildRequest());

      await expect(service.requestDeletion('user-1')).rejects.toThrow(
        DeletionRequestAlreadyPendingException,
      );
      expect(deletionRequestRepository.insert).not.toHaveBeenCalled();
    });

    test('happy path inserts a pending request and dispatches the confirmation email', async () => {
      const user = buildUser();
      userRepository.findById.mockResolvedValue(user);
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(null);
      deletionRequestRepository.insert.mockResolvedValue(
        buildRequest({ id: 'request-99' }),
      );

      const result = await service.requestDeletion('user-1');

      expect(result.requestId).toBe('request-99');
      expect(notificationPort.sendTransactional).toHaveBeenCalledTimes(1);
      expect(notificationPort.sendTransactional).toHaveBeenCalledWith(
        { address: user.email, name: user.username },
        expect.any(String),
        'd-test-deletion-request-template',
        expect.objectContaining({ code: expect.stringMatching(/^\d{6}$/) }),
      );
    });
  });

  describe('confirmDeletion', () => {
    test('throws DeletionRequestNotFoundException when no pending request exists for the user', async () => {
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(null);

      await expect(service.confirmDeletion('user-1', '123456')).rejects.toThrow(
        DeletionRequestNotFoundException,
      );
    });

    test('throws DeletionOtpExpiredException when the request has expired', async () => {
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(
        buildRequest({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.confirmDeletion('user-1', '123456')).rejects.toThrow(
        DeletionOtpExpiredException,
      );
    });

    test('throws DeletionOtpInvalidException when the submitted code does not match', async () => {
      userRepository.findById.mockResolvedValue(buildUser());
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(buildRequest());

      await expect(service.confirmDeletion('user-1', 'wrong-code')).rejects.toThrow(
        DeletionOtpInvalidException,
      );
    });

    test('successful confirm invalidates every session for the user', async () => {
      const user = buildUser();
      userRepository.findById.mockResolvedValue(user);
      const code = '654321';
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(
        buildRequest({
          codeHash: hashTestCode(code),
        }),
      );

      await service.confirmDeletion('user-1', code);

      const sessionInvalidationCall = mockClient.query.mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes('UPDATE sessions'),
      );
      expect(sessionInvalidationCall).toBeDefined();
      expect(sessionInvalidationCall![1]).toEqual([expect.any(Date), user.id]);
    });

    test('successful confirm inserts exactly one notification record with the pre-anonymization email', async () => {
      const user = buildUser({ email: 'original@example.test' });
      userRepository.findById.mockResolvedValue(user);
      const code = '111222';
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(
        buildRequest({
          codeHash: hashTestCode(code),
        }),
      );

      await service.confirmDeletion('user-1', code);

      const insertCalls = mockClient.query.mock.calls.filter(
        ([sql]) =>
          typeof sql === 'string' && sql.includes('INSERT INTO account_deletion_notification_records'),
      );
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0][1]).toEqual([user.id, 'original@example.test', expect.any(Date)]);
    });

    test('successful confirm anonymizes the user and marks the request confirmed', async () => {
      const user = buildUser();
      userRepository.findById.mockResolvedValue(user);
      const code = '999888';
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(
        buildRequest({
          codeHash: hashTestCode(code),
        }),
      );

      const result = await service.confirmDeletion('user-1', code);

      expect(result.userId).toBe(user.id);
      const userUpdateCall = mockClient.query.mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes("UPDATE users"),
      );
      expect(userUpdateCall).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    test('rolls back the transaction if a write fails mid-way', async () => {
      const code = '333444';
      userRepository.findById.mockResolvedValue(buildUser());
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(
        buildRequest({
          codeHash: hashTestCode(code),
        }),
      );
      mockClient.query = jest.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN') return { rows: [] };
        throw new Error('simulated DB failure');
      });

      await expect(service.confirmDeletion('user-1', code)).rejects.toThrow(
        'simulated DB failure',
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelDeletion', () => {
    test('throws DeletionRequestNotFoundException when no pending request exists', async () => {
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(null);

      await expect(service.cancelDeletion('user-1')).rejects.toThrow(
        DeletionRequestNotFoundException,
      );
      expect(deletionRequestRepository.updateStatus).not.toHaveBeenCalled();
    });

    test('cancels the pending request without touching the user account', async () => {
      const request = buildRequest();
      deletionRequestRepository.findPendingByUserId.mockResolvedValue(request);

      await service.cancelDeletion('user-1');

      expect(deletionRequestRepository.updateStatus).toHaveBeenCalledWith(
        request.id,
        'cancelled',
        expect.any(Date),
      );
      expect(userRepository.anonymizeAndMarkDeleted).not.toHaveBeenCalled();
      expect(pool.connect).not.toHaveBeenCalled();
    });
  });
});
