/**
 * user.repository.ts
 *
 * Repository for the `users` table.  All queries use parameterised `?`
 * placeholders — no string interpolation.
 *
 * Requirements: US-064 FR-003–004, FR-008; US-074 FR-008, FR-010, FR-015;
 *               US-036 FR-002, FR-006–009, FR-018 (F-03 additions)
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { UserEntity } from '../types/registration.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IUserRepository {
  insert(entity: Omit<UserEntity, 'id'>): Promise<UserEntity>;
  findByNormalisedUsername(normalised: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  updateStatus(
    id: string,
    status: 'active' | 'suspended',
    activatedAt: Date,
  ): Promise<void>;
  // --- F-03 additions ---
  findByEmail(email: string): Promise<UserEntity | null>;
  incrementFailedLoginCount(id: string): Promise<void>;
  resetFailedLoginCount(id: string): Promise<void>;
  lockAccount(id: string, lockedUntil: Date): Promise<void>;
  updateLastLoginAt(id: string, timestamp: Date): Promise<void>;
  updatePasswordHash(id: string, hash: string): Promise<void>;
  // --- F-04 additions ---
  anonymizeAndMarkDeleted(
    id: string,
    anonymizedEmail: string,
    anonymizedUsername: string,
    deletedAt: Date,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row type returned by better-sqlite3
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  username: string;
  username_normalised: string;
  email: string;
  password_hash: string;
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  registration_timestamp: string;
  activated_at: string | null;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: UserRow): UserEntity {
  return {
    id: row.id,
    username: row.username,
    usernameNormalised: row.username_normalised,
    email: row.email,
    passwordHash: row.password_hash,
    status: row.status,
    registrationTimestamp: new Date(row.registration_timestamp),
    activatedAt: row.activated_at === null ? null : new Date(row.activated_at),
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until === null ? null : new Date(row.locked_until),
    lastLoginAt: row.last_login_at === null ? null : new Date(row.last_login_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class UserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  /**
   * Insert a new user row and return the persisted entity (with generated id).
   */
  async insert(entity: Omit<UserEntity, 'id'>): Promise<UserEntity> {
    const id = uuidv4();
    const sql = `
      INSERT INTO users
        (id, username, username_normalised, email, password_hash, status,
         registration_timestamp, activated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db
      .prepare(sql)
      .run(
        id,
        entity.username,
        entity.usernameNormalised,
        entity.email,
        entity.passwordHash,
        entity.status,
        entity.registrationTimestamp.toISOString(),
        entity.activatedAt === null ? null : entity.activatedAt.toISOString(),
      );

    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    return rowToEntity(row);
  }

  /**
   * Look up a user by their normalised (lowercased + trimmed) username.
   * Returns null if no match is found.
   */
  async findByNormalisedUsername(normalised: string): Promise<UserEntity | null> {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username_normalised = ? LIMIT 1')
      .get(normalised) as UserRow | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Look up a user by their primary key UUID.
   * Returns null if no match is found.
   */
  async findById(id: string): Promise<UserEntity | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(id) as
      | UserRow
      | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Update the user's status and set activated_at.
   * Used during account activation (pending → active).
   */
  async updateStatus(
    id: string,
    status: 'active' | 'suspended',
    activatedAt: Date,
  ): Promise<void> {
    this.db
      .prepare('UPDATE users SET status = ?, activated_at = ? WHERE id = ?')
      .run(status, activatedAt.toISOString(), id);
  }

  // ---------------------------------------------------------------------
  // F-03 additions (US-036 FR-002, FR-006–009, FR-018)
  // ---------------------------------------------------------------------

  /**
   * Look up a user by email address. Used by AuthService.login() to resolve
   * the account before verifying credentials.
   * Returns null if no match is found.
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').get(email) as
      | UserRow
      | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Increment the consecutive failed-login counter by 1.
   * Called by LoginGuard.registerFailure() on a bad-password attempt.
   */
  async incrementFailedLoginCount(id: string): Promise<void> {
    this.db
      .prepare('UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = ?')
      .run(id);
  }

  /**
   * Reset the consecutive failed-login counter to 0.
   * Called on every successful login (FR-009) and when a lockout is applied
   * (the counter restarts clean for the next window).
   */
  async resetFailedLoginCount(id: string): Promise<void> {
    this.db.prepare('UPDATE users SET failed_login_count = 0 WHERE id = ?').run(id);
  }

  /**
   * Apply a temporary lockout by setting locked_until. This is a
   * self-clearing throttle, distinct from `status = 'suspended'`.
   */
  async lockAccount(id: string, lockedUntil: Date): Promise<void> {
    this.db
      .prepare('UPDATE users SET locked_until = ? WHERE id = ?')
      .run(lockedUntil.toISOString(), id);
  }

  /**
   * Record the timestamp of a successful login (FR-006).
   */
  async updateLastLoginAt(id: string, timestamp: Date): Promise<void> {
    this.db
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .run(timestamp.toISOString(), id);
  }

  /**
   * Replace the stored password hash after a successful password reset
   * (FR-014). The plaintext password is never passed to this repository.
   */
  async updatePasswordHash(id: string, hash: string): Promise<void> {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }

  // ---------------------------------------------------------------------
  // F-04 additions (US-022 FR-004, FR-006)
  // ---------------------------------------------------------------------

  /**
   * Irreversibly anonymize the user's PII and mark the account 'deleted'.
   * Called only from within AccountDeletionService.confirmDeletion()'s
   * transaction — callers MUST capture the pre-anonymization email
   * themselves beforehand (this method does not return the prior values).
   *
   * Also overwrites username_normalised (not just username) — otherwise the
   * original normalised value stays UNIQUE-reserved forever under
   * uidx_users_username_normalised, permanently blocking anyone else from
   * ever registering with that username even after this account is deleted.
   */
  async anonymizeAndMarkDeleted(
    id: string,
    anonymizedEmail: string,
    anonymizedUsername: string,
    deletedAt: Date,
  ): Promise<void> {
    this.db
      .prepare(
        `UPDATE users
         SET status = 'deleted',
             email = ?,
             username = ?,
             username_normalised = lower(?),
             deleted_at = ?
         WHERE id = ?`,
      )
      .run(anonymizedEmail, anonymizedUsername, anonymizedUsername, deletedAt.toISOString(), id);
  }
}
