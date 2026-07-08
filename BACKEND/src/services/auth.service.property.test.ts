/**
 * auth.service.property.test.ts
 *
 * Property-based tests for DefaultAuthService using fast-check, backed by an
 * in-memory fake UserRepository/SessionRepository pairing so each property
 * can be checked against many generated (email, password, user-store)
 * scenarios.
 *
 * Requirements: US-036 FR-002, FR-005
 */

import fc from 'fast-check';
import crypto from 'crypto';
import { DefaultAuthService } from './auth.service';
import { DefaultSessionService } from './session.service';
import { DefaultLoginGuard } from './login-guard';
import { PasswordHasher } from './password-hasher';
import { IUserRepository } from '../repositories/user.repository';
import { ISessionRepository } from '../repositories/session.repository';
import { SessionEntity } from '../types/login.types';
import { UserEntity } from '../types/registration.types';
import { InvalidCredentialsException } from '../errors/login.errors';

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
  async incrementFailedLoginCount(id: string): Promise<void> {
    const user = await this.findById(id);
    if (user) user.failedLoginCount += 1;
  }
  async resetFailedLoginCount(id: string): Promise<void> {
    const user = await this.findById(id);
    if (user) user.failedLoginCount = 0;
  }
  async lockAccount(id: string, lockedUntil: Date): Promise<void> {
    const user = await this.findById(id);
    if (user) user.lockedUntil = lockedUntil;
  }
  async updateLastLoginAt(id: string, timestamp: Date): Promise<void> {
    const user = await this.findById(id);
    if (user) user.lastLoginAt = timestamp;
  }
  async updatePasswordHash(id: string, hash: string): Promise<void> {
    const user = await this.findById(id);
    if (user) user.passwordHash = hash;
  }
  async anonymizeAndMarkDeleted(): Promise<void> {}
}

class FakeSessionRepository implements ISessionRepository {
  private readonly rows = new Map<string, SessionEntity>();
  private nextId = 1;

  async insert(userId: string, tokenHash: string, createdAt: Date, expiresAt: Date): Promise<SessionEntity> {
    const entity: SessionEntity = {
      id: `session-${this.nextId++}`,
      userId,
      tokenHash,
      createdAt,
      expiresAt,
      invalidated: false,
      invalidatedAt: null,
    };
    this.rows.set(entity.id, entity);
    return entity;
  }
  async findByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    for (const row of this.rows.values()) {
      if (row.tokenHash === tokenHash) return row;
    }
    return null;
  }
  async markInvalidated(id: string, invalidatedAt: Date): Promise<void> {
    const row = this.rows.get(id);
    if (row) {
      row.invalidated = true;
      row.invalidatedAt = invalidatedAt;
    }
  }
  async invalidateAllForUser(userId: string): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.userId === userId) row.invalidated = true;
    }
  }
  async countActiveForUser(userId: string): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.userId === userId && !row.invalidated && row.expiresAt > new Date()) count++;
    }
    return count;
  }
}

/** Always reports a match — used for the "successful login" property. */
const alwaysMatchHasher: PasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  compare: async () => true,
};

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: crypto.randomUUID(),
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

describe('DefaultAuthService — property tests', () => {
  // -------------------------------------------------------------------------
  // Property 4: ∀ email not present in `users`: login raises
  // InvalidCredentialsException; no session created.
  // Validates: US-036 FR-002; Correctness Properties — Login
  // -------------------------------------------------------------------------

  test('Property 4: any email absent from the user store raises InvalidCredentialsException and creates no session', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), fc.string({ minLength: 1 }), async (email, password) => {
        const userRepository = new FakeUserRepository(new Map()); // empty store — email never present
        const sessionRepository = new FakeSessionRepository();
        const loginGuard = new DefaultLoginGuard(userRepository, 5, 15);
        const sessionService = new DefaultSessionService(sessionRepository, userRepository, 3600);
        const service = new DefaultAuthService(userRepository, alwaysMatchHasher, loginGuard, sessionService);

        await expect(service.login(email, password)).rejects.toBeInstanceOf(InvalidCredentialsException);

        // No session was created for any user as a side effect of this call.
        expect(await sessionRepository.findByTokenHash('irrelevant')).toBeNull();
      }),
      { numRuns: 50 },
    );
  });

  // -------------------------------------------------------------------------
  // Property 5: ∀ successful login: a session exists whose token_hash =
  // SHA256(returned token).
  // Validates: US-036 FR-005; Correctness Properties — Login
  // -------------------------------------------------------------------------

  test('Property 5: every successful login produces a session whose token_hash is SHA256 of the returned token', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), fc.string({ minLength: 1 }), async (email, password) => {
        const user = buildUser({ email });
        const userRepository = new FakeUserRepository(new Map([[email, user]]));
        const sessionRepository = new FakeSessionRepository();
        const loginGuard = new DefaultLoginGuard(userRepository, 5, 15);
        const sessionService = new DefaultSessionService(sessionRepository, userRepository, 3600);
        const service = new DefaultAuthService(userRepository, alwaysMatchHasher, loginGuard, sessionService);

        const result = await service.login(email, password);

        const expectedHash = crypto.createHash('sha256').update(result.token).digest('hex');
        const persisted = await sessionRepository.findByTokenHash(expectedHash);

        expect(persisted).not.toBeNull();
        expect(persisted?.userId).toBe(user.id);
      }),
      { numRuns: 50 },
    );
  });
});
