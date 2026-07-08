/**
 * session.service.property.test.ts
 *
 * Property-based tests for DefaultSessionService using fast-check.
 * Backed by an in-memory fake repository (rather than jest.fn() call
 * assertions) so each property can be checked against many generated
 * scenarios without hand-writing per-case mocks.
 *
 * Requirements: US-038 FR-004–006, EC-001, EC-005
 */

import fc from 'fast-check';
import crypto from 'crypto';
import { DefaultSessionService } from './session.service';
import { ISessionRepository } from '../repositories/session.repository';
import { IUserRepository } from '../repositories/user.repository';
import { SessionEntity } from '../types/login.types';
import { UserEntity } from '../types/registration.types';

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

class FakeSessionRepository implements ISessionRepository {
  private readonly rows = new Map<string, SessionEntity>();
  private nextId = 1;

  async insert(
    userId: string,
    tokenHash: string,
    createdAt: Date,
    expiresAt: Date,
  ): Promise<SessionEntity> {
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
      if (row.userId === userId && !row.invalidated) {
        row.invalidated = true;
        row.invalidatedAt = new Date();
      }
    }
  }

  async countActiveForUser(userId: string): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.userId === userId && !row.invalidated && row.expiresAt > new Date()) count++;
    }
    return count;
  }

  /** Test-only helper to seed a row directly, bypassing insert(). */
  seed(entity: SessionEntity): void {
    this.rows.set(entity.id, entity);
  }

  /** Test-only helper to read back current state for assertions. */
  get(id: string): SessionEntity | undefined {
    return this.rows.get(id);
  }
}

class FakeUserRepository implements IUserRepository {
  constructor(private readonly usersById: Map<string, UserEntity> = new Map()) {}

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

function buildSession(overrides: Partial<SessionEntity> = {}): SessionEntity {
  return {
    id: overrides.id ?? 'session-seed',
    userId: 'user-1',
    tokenHash: 'irrelevant-hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-01T01:00:00.000Z'),
    invalidated: false,
    invalidatedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Property 1: createSession -> immediate validateSession returns valid: true
// Validates: US-038 FR-001–002, FR-008–009; Correctness Properties — Session Lifecycle
// ---------------------------------------------------------------------------

describe('DefaultSessionService — property tests', () => {
  test('Property 1: any raw token returned by createSession validates as valid immediately after', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 86_400 }),
        async (userId, expirySeconds) => {
          const sessionRepository = new FakeSessionRepository();
          const userRepository = new FakeUserRepository();
          const service = new DefaultSessionService(sessionRepository, userRepository, expirySeconds);

          const { rawToken } = await service.createSession(userId);
          const result = await service.validateSession(rawToken);

          expect(result).toEqual({ valid: true, userId });
        },
      ),
      { numRuns: 50 },
    );
  });

  // -------------------------------------------------------------------------
  // Property 2: now > expires_at => EXPIRED, regardless of `invalidated`
  // Validates: US-038 FR-004, EC-001
  // -------------------------------------------------------------------------

  test('Property 2: a session past its expiry always validates as EXPIRED regardless of invalidated flag', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.integer({ min: 1, max: 1_000 * 60 * 60 * 24 }), // ms in the past
        async (invalidated, msInPast) => {
          const sessionRepository = new FakeSessionRepository();
          const userRepository = new FakeUserRepository();
          const service = new DefaultSessionService(sessionRepository, userRepository, 3600);

          const rawToken = crypto.randomBytes(16).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

          sessionRepository.seed(
            buildSession({
              id: 'session-expired',
              tokenHash,
              invalidated,
              expiresAt: new Date(Date.now() - msInPast),
            }),
          );

          const result = await service.validateSession(rawToken);

          expect(result).toEqual({ valid: false, reason: 'EXPIRED' });
        },
      ),
      { numRuns: 50 },
    );
  });

  // -------------------------------------------------------------------------
  // Property 3: 1..N invalidateSession(t) calls on the same token converge to
  // the same final state as a single call (idempotency, EC-005)
  // Validates: US-038 FR-005; EC-005 idempotency
  // -------------------------------------------------------------------------

  test('Property 3: repeated invalidateSession calls on the same token converge to one invalidation', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (callCount) => {
        const sessionRepository = new FakeSessionRepository();
        const userRepository = new FakeUserRepository();
        const service = new DefaultSessionService(sessionRepository, userRepository, 3600);

        const rawToken = crypto.randomBytes(16).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        sessionRepository.seed(
          buildSession({
            id: 'session-idempotent',
            tokenHash,
            expiresAt: new Date(Date.now() + 60_000),
          }),
        );

        const results = [];
        for (let i = 0; i < callCount; i++) {
          results.push(await service.invalidateSession(rawToken));
        }

        // First call actually invalidates; every subsequent call reports
        // "already terminated" — the underlying row is untouched thereafter.
        expect(results[0]).toEqual({ alreadyTerminated: false });
        for (let i = 1; i < results.length; i++) {
          expect(results[i]).toEqual({ alreadyTerminated: true });
        }

        const finalState = sessionRepository.get('session-idempotent');
        expect(finalState?.invalidated).toBe(true);
        expect(finalState?.invalidatedAt).not.toBeNull();
      }),
      { numRuns: 50 },
    );
  });
});
