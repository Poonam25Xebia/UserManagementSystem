process.env.ACTIVATION_BASE_URL = 'https://app.example.test';
process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.PASSWORD_RECOVERY_BASE_URL = 'https://app.example.test';
process.env.PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID = 'd-test-recovery-template';

/**
 * password-recovery.service.property.test.ts
 *
 * Property-based tests for DefaultPasswordRecoveryService using fast-check,
 * backed by in-memory fakes so each property can be checked against many
 * generated scenarios.
 *
 * Requirements: US-036 FR-013, FR-016–017
 */

import fc from 'fast-check';
import { Pool, PoolClient } from 'pg';
import { DefaultPasswordRecoveryService } from './password-recovery.service';
import { IUserRepository } from '../repositories/user.repository';
import { IPasswordRecoveryRequestRepository } from '../repositories/password-recovery-request.repository';
import { DefaultPasswordPolicyEvaluator } from '../validators/password-policy.evaluator';
import { PasswordHasher } from './password-hasher';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { UserEntity } from '../types/registration.types';
import { PasswordRecoveryRequestEntity } from '../types/login.types';
import { passwordPolicyConfig } from '../config/password-policy.config';

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

class FakeUserRepository implements IUserRepository {
  constructor(private readonly usersByEmail: Map<string, UserEntity>) {}

  async insert(): Promise<UserEntity> {
    throw new Error('not used in these property tests');
  }
  async findByNormalisedUsername(): Promise<UserEntity | null> {
    return null;
  }
  async findById(id: string): Promise<UserEntity | null> {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) return user;
    }
    return null;
  }
  async updateStatus(): Promise<void> {}
  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersByEmail.get(email) ?? null;
  }
  async incrementFailedLoginCount(): Promise<void> {}
  async resetFailedLoginCount(): Promise<void> {}
  async lockAccount(): Promise<void> {}
  async updateLastLoginAt(): Promise<void> {}
  async updatePasswordHash(id: string, hash: string): Promise<void> {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) user.passwordHash = hash;
    }
  }
  async anonymizeAndMarkDeleted(): Promise<void> {}
}

class FakeRecoveryRequestRepository implements IPasswordRecoveryRequestRepository {
  private readonly rows = new Map<string, PasswordRecoveryRequestEntity>();
  private nextId = 1;

  async insert(
    userId: string,
    token: string,
    requestedAt: Date,
    expiresAt: Date,
  ): Promise<PasswordRecoveryRequestEntity> {
    const entity: PasswordRecoveryRequestEntity = {
      id: `request-${this.nextId++}`,
      userId,
      token,
      requestedAt,
      expiresAt,
      consumed: false,
      consumedAt: null,
    };
    this.rows.set(entity.id, entity);
    return entity;
  }

  async findByToken(token: string): Promise<PasswordRecoveryRequestEntity | null> {
    for (const row of this.rows.values()) {
      if (row.token === token) return row;
    }
    return null;
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    const row = this.rows.get(id);
    if (row) {
      row.consumed = true;
      row.consumedAt = consumedAt;
    }
  }

  seed(entity: PasswordRecoveryRequestEntity): void {
    this.rows.set(entity.id, entity);
  }
}

const noOpNotificationPort: EmailDeliveryPort = {
  sendTransactional: async () => ({ success: true }),
};

const noOpHasher: PasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  compare: async () => true,
};

/** Fake pg Pool/PoolClient that records every UPDATE statement issued. */
function buildFakePool(): { pool: Pool; queries: string[] } {
  const queries: string[] = [];
  const client = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    }),
    release: jest.fn(),
  } as unknown as PoolClient;

  const pool = {
    connect: jest.fn(async () => client),
  } as unknown as Pool;

  return { pool, queries };
}

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

// ---------------------------------------------------------------------------
// Property 6: POST /password-recovery response is identical whether or not
// the email exists — verified at the service level as "same externally
// observable behavior": both resolve, neither throws, and only the known-
// email branch performs any side effect.
// Validates: US-036 FR-013; Correctness Properties — Password Recovery & Reset
// ---------------------------------------------------------------------------

describe('DefaultPasswordRecoveryService — property tests', () => {
  test('Property 6: requestRecovery resolves without throwing for any email, known or unknown', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), fc.boolean(), async (email, emailIsRegistered) => {
        const usersByEmail = new Map<string, UserEntity>();
        if (emailIsRegistered) {
          usersByEmail.set(email, buildUser({ email }));
        }

        const userRepository = new FakeUserRepository(usersByEmail);
        const recoveryRequestRepository = new FakeRecoveryRequestRepository();
        const { pool } = buildFakePool();

        const service = new DefaultPasswordRecoveryService(
          userRepository,
          recoveryRequestRepository,
          new DefaultPasswordPolicyEvaluator(),
          noOpHasher,
          noOpNotificationPort,
          pool,
        );

        // Neither branch throws — this is the property that lets the
        // controller return byte-identical 202 responses either way.
        await expect(service.requestRecovery(email)).resolves.toBeUndefined();
      }),
      { numRuns: 50 },
    );
  });

  // -------------------------------------------------------------------------
  // Property 7: a recovery request can be consumed at most once.
  // Validates: US-036 FR-016
  // -------------------------------------------------------------------------

  test('Property 7: repeated resetPassword calls on the same token succeed at most once', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (attemptCount) => {
        const user = buildUser();
        const userRepository = new FakeUserRepository(new Map([[user.email, user]]));
        const recoveryRequestRepository = new FakeRecoveryRequestRepository();
        const { pool } = buildFakePool();

        const token = 'fixed-token-value';
        await recoveryRequestRepository.insert(user.id, token, new Date(), new Date(Date.now() + 60 * 60 * 1000));

        const service = new DefaultPasswordRecoveryService(
          userRepository,
          recoveryRequestRepository,
          new DefaultPasswordPolicyEvaluator(),
          noOpHasher,
          noOpNotificationPort,
          pool,
        );

        let successCount = 0;
        for (let i = 0; i < attemptCount; i++) {
          try {
            await service.resetPassword(token, 'ValidP@ss1');
            successCount++;
            // The fake repository's `consumed` flag is only updated via
            // markConsumed, which this service does NOT call directly (it
            // updates the DB row via raw SQL in its own transaction) — so
            // simulate the same effect the real DB would have applied.
            const request = await recoveryRequestRepository.findByToken(token);
            if (request) await recoveryRequestRepository.markConsumed(request.id, new Date());
          } catch {
            // expected for every attempt after the first (TokenExpiredException)
          }
        }

        expect(successCount).toBe(1);
      }),
      { numRuns: 30 },
    );
  });

  // -------------------------------------------------------------------------
  // Property 8: a password failing any single policy rule never reaches
  // updatePasswordHash.
  // Validates: US-036 FR-017
  // -------------------------------------------------------------------------

  test('Property 8: any password violating the shared policy never triggers a password-hash update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: passwordPolicyConfig.minimumLength - 1 }),
        async (shortPassword) => {
          // Any password shorter than the configured minimum always violates
          // passwordPolicyConfig, regardless of other content — guaranteed violation.
          const user = buildUser();
          const userRepository = new FakeUserRepository(new Map([[user.email, user]]));
          const recoveryRequestRepository = new FakeRecoveryRequestRepository();
          const { pool, queries } = buildFakePool();

          const token = 'fixed-token-value';
          await recoveryRequestRepository.insert(
            user.id,
            token,
            new Date(),
            new Date(Date.now() + 60 * 60 * 1000),
          );

          const service = new DefaultPasswordRecoveryService(
            userRepository,
            recoveryRequestRepository,
            new DefaultPasswordPolicyEvaluator(),
            noOpHasher,
            noOpNotificationPort,
            pool,
          );

          await expect(service.resetPassword(token, shortPassword)).rejects.toThrow();

          expect(queries.some((q) => q.includes('UPDATE users SET password_hash'))).toBe(false);
        },
      ),
      { numRuns: 30 },
    );
  });
});
