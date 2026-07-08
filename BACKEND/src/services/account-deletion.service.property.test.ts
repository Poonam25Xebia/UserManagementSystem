process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
process.env.ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID = 'd-test-deletion-request-template';
process.env.ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID = 'd-test-deletion-notice-template';

/**
 * account-deletion.service.property.test.ts
 *
 * Property-based tests for DefaultAccountDeletionService using fast-check,
 * backed by in-memory fakes so each property can be checked against many
 * generated scenarios.
 *
 * Requirements: US-023 FR-005–007; US-022 FR-004
 */

import crypto from 'crypto';
import fc from 'fast-check';
import { Pool, PoolClient } from 'pg';
import { DefaultAccountDeletionService } from './account-deletion.service';
import { IUserRepository } from '../repositories/user.repository';
import { IDeletionRequestRepository } from '../repositories/deletion-request.repository';
import { IDeletionNotificationRecordRepository } from '../repositories/deletion-notification-record.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { UserEntity } from '../types/registration.types';
import { DeletionRequestEntity, DeletionNotificationRecord } from '../types/account-deletion.types';
import { DeletionRequestNotFoundException } from '../errors/account-deletion.errors';

function hashTestCode(code: string): string {
  return crypto.createHmac('sha256', 'test-otp-secret').update(code).digest('hex');
}

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

class FakeUserRepository implements IUserRepository {
  constructor(private readonly usersById: Map<string, UserEntity>) {}

  async insert(): Promise<UserEntity> {
    throw new Error('not used in these property tests');
  }
  async findByNormalisedUsername(): Promise<UserEntity | null> {
    return null;
  }
  async findById(id: string): Promise<UserEntity | null> {
    return this.usersById.get(id) ?? null;
  }
  async updateStatus(): Promise<void> {}
  async findByEmail(): Promise<UserEntity | null> {
    return null;
  }
  async incrementFailedLoginCount(): Promise<void> {}
  async resetFailedLoginCount(): Promise<void> {}
  async lockAccount(): Promise<void> {}
  async updateLastLoginAt(): Promise<void> {}
  async updatePasswordHash(): Promise<void> {}
  async anonymizeAndMarkDeleted(): Promise<void> {}
}

class FakeDeletionRequestRepository implements IDeletionRequestRepository {
  private readonly rows = new Map<string, DeletionRequestEntity>();
  private nextId = 1;

  async insert(
    userId: string,
    codeHash: string,
    issuedAt: Date,
    expiresAt: Date,
  ): Promise<DeletionRequestEntity> {
    const entity: DeletionRequestEntity = {
      id: `request-${this.nextId++}`,
      userId,
      codeHash,
      issuedAt,
      expiresAt,
      status: 'pending',
      confirmedAt: null,
      cancelledAt: null,
    };
    this.rows.set(entity.id, entity);
    return entity;
  }

  async findPendingByUserId(userId: string): Promise<DeletionRequestEntity | null> {
    for (const row of this.rows.values()) {
      if (row.userId === userId && row.status === 'pending') return row;
    }
    return null;
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled', timestamp: Date): Promise<void> {
    const row = this.rows.get(id);
    if (row) {
      row.status = status;
      if (status === 'confirmed') row.confirmedAt = timestamp;
      else row.cancelledAt = timestamp;
    }
  }

  seed(entity: DeletionRequestEntity): void {
    this.rows.set(entity.id, entity);
  }
}

class FakeDeletionNotificationRecordRepository implements IDeletionNotificationRecordRepository {
  private readonly rows: DeletionNotificationRecord[] = [];
  private nextId = 1;

  async insert(
    userId: string,
    recipientAddress: string,
    deletionDate: Date,
  ): Promise<DeletionNotificationRecord> {
    const record: DeletionNotificationRecord = {
      recordId: `record-${this.nextId++}`,
      userId,
      recipientAddress,
      deletionDate,
      dispatchTimestamp: new Date(),
      deliveryStatus: 'queued',
      retryCount: 0,
    };
    this.rows.push(record);
    return record;
  }

  async findByStatus(status: 'queued' | 'sent' | 'failed'): Promise<DeletionNotificationRecord[]> {
    return this.rows.filter((r) => r.deliveryStatus === status);
  }

  async updateStatus(recordId: string, status: 'sent' | 'failed'): Promise<void> {
    const row = this.rows.find((r) => r.recordId === recordId);
    if (row) row.deliveryStatus = status;
  }

  async incrementRetryCount(recordId: string): Promise<void> {
    const row = this.rows.find((r) => r.recordId === recordId);
    if (row) row.retryCount += 1;
  }
}

const noOpNotificationPort: EmailDeliveryPort = {
  sendTransactional: async () => ({ success: true }),
};

/**
 * Fake pg Pool/PoolClient that actually applies confirmDeletion's raw SQL
 * writes to the same in-memory fakes, so property assertions can observe
 * the post-transaction state exactly as a real Postgres commit would leave it.
 */
function buildFakePool(
  usersById: Map<string, UserEntity>,
  notificationRecordRepository: FakeDeletionNotificationRecordRepository,
  deletionRequestRepository: FakeDeletionRequestRepository,
): Pool {
  const client = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('UPDATE users')) {
        const [anonymizedEmail, anonymizedUsername, usernameNormalised, deletedAt, userId] =
          params as [string, string, string, Date, string];
        const user = usersById.get(userId);
        if (user) {
          user.status = 'deleted';
          user.email = anonymizedEmail;
          user.username = anonymizedUsername;
          user.usernameNormalised = usernameNormalised;
          user.deletedAt = deletedAt;
        }
      } else if (sql.includes('UPDATE account_deletion_requests')) {
        const [confirmedAt, requestId] = params as [Date, string];
        await deletionRequestRepository.updateStatus(requestId, 'confirmed', confirmedAt);
      } else if (sql.includes('INSERT INTO account_deletion_notification_records')) {
        const [userId, recipientAddress, deletionDate] = params as [string, string, Date];
        await notificationRecordRepository.insert(userId, recipientAddress, deletionDate);
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  } as unknown as PoolClient;

  return {
    connect: jest.fn(async () => client),
  } as unknown as Pool;
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

// ---------------------------------------------------------------------------
// Property 1: a confirmation code can finalize a deletion at most once.
// Validates: design.md Correctness Properties #2 — code single-use
// ---------------------------------------------------------------------------

describe('DefaultAccountDeletionService — property tests', () => {
  test('Property 1: repeated confirmDeletion calls with the same code succeed at most once', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), async (attemptCount) => {
        const user = buildUser({ id: `user-${Math.random()}` });
        const usersById = new Map([[user.id, user]]);
        const userRepository = new FakeUserRepository(usersById);
        const deletionRequestRepository = new FakeDeletionRequestRepository();
        const notificationRecordRepository = new FakeDeletionNotificationRecordRepository();
        const pool = buildFakePool(usersById, notificationRecordRepository, deletionRequestRepository);

        const code = '123456';
        await deletionRequestRepository.insert(
          user.id,
          hashTestCode(code),
          new Date(),
          new Date(Date.now() + 60 * 60 * 1000),
        );

        const service = new DefaultAccountDeletionService(
          userRepository,
          deletionRequestRepository,
          noOpNotificationPort,
          pool,
        );

        let successCount = 0;
        for (let i = 0; i < attemptCount; i++) {
          try {
            await service.confirmDeletion(user.id, code);
            successCount++;
          } catch (err) {
            // Once confirmed, the request is no longer 'pending', so
            // findPendingByUserId returns null for every subsequent attempt.
            expect(err).toBeInstanceOf(DeletionRequestNotFoundException);
          }
        }

        expect(successCount).toBe(1);
      }),
      { numRuns: 30 },
    );
  });

  // -------------------------------------------------------------------------
  // Property 2: deletedAt is always >= the originating request's issuedAt.
  // Validates: design.md Correctness Properties #3
  // -------------------------------------------------------------------------

  test('Property 2: a successful confirmDeletion always reports deletedAt >= issuedAt', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 5000 }), async (delayMs) => {
        const user = buildUser({ id: `user-${Math.random()}` });
        const usersById = new Map([[user.id, user]]);
        const userRepository = new FakeUserRepository(usersById);
        const deletionRequestRepository = new FakeDeletionRequestRepository();
        const notificationRecordRepository = new FakeDeletionNotificationRecordRepository();
        const pool = buildFakePool(usersById, notificationRecordRepository, deletionRequestRepository);

        const code = `${Math.floor(Math.random() * 1_000_000)}`.padStart(6, '0');
        const issuedAt = new Date();
        const request = await deletionRequestRepository.insert(
          user.id,
          hashTestCode(code),
          issuedAt,
          new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000),
        );

        const service = new DefaultAccountDeletionService(
          userRepository,
          deletionRequestRepository,
          noOpNotificationPort,
          pool,
        );

        await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 5)));
        const result = await service.confirmDeletion(user.id, code);

        expect(result.deletedAt.getTime()).toBeGreaterThanOrEqual(request.issuedAt.getTime());
      }),
      { numRuns: 20 },
    );
  });

  // -------------------------------------------------------------------------
  // Property 3: the anonymized email/username never equal the originals.
  // Validates: US-022 FR-004 (data removal)
  // -------------------------------------------------------------------------

  test('Property 3: confirmDeletion never leaves the anonymized email/username equal to the original', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        async (originalEmail, originalUsername) => {
          const user = buildUser({
            id: `user-${Math.random()}`,
            email: originalEmail,
            username: originalUsername,
            usernameNormalised: originalUsername.toLowerCase(),
          });
          const usersById = new Map([[user.id, user]]);
          const userRepository = new FakeUserRepository(usersById);
          const deletionRequestRepository = new FakeDeletionRequestRepository();
          const notificationRecordRepository = new FakeDeletionNotificationRecordRepository();
          const pool = buildFakePool(usersById, notificationRecordRepository, deletionRequestRepository);

          const code = `${Math.floor(Math.random() * 1_000_000)}`.padStart(6, '0');
          await deletionRequestRepository.insert(
            user.id,
            hashTestCode(code),
            new Date(),
            new Date(Date.now() + 60 * 60 * 1000),
          );

          const service = new DefaultAccountDeletionService(
            userRepository,
            deletionRequestRepository,
            noOpNotificationPort,
            pool,
          );

          await service.confirmDeletion(user.id, code);

          const persisted = usersById.get(user.id)!;
          expect(persisted.email).not.toBe(originalEmail);
          expect(persisted.username).not.toBe(originalUsername);
          expect(persisted.status).toBe('deleted');
        },
      ),
      { numRuns: 30 },
    );
  });
});
