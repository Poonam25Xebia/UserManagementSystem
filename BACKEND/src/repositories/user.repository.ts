/**
 * user.repository.ts
 *
 * Repository for the `users` table.  All queries use parameterised `pg`
 * placeholders — no string interpolation.
 *
 * Requirements: US-064 FR-003–004, FR-008; US-074 FR-008, FR-010, FR-015;
 *               US-036 FR-002, FR-006–009, FR-018 (F-03 additions)
 */

import { Pool, QueryResult } from 'pg';
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
// Row type returned by pg
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  username: string;
  username_normalised: string;
  email: string;
  password_hash: string;
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  registration_timestamp: Date;
  activated_at: Date | null;
  failed_login_count: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  deleted_at: Date | null;
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
    registrationTimestamp: row.registration_timestamp,
    activatedAt: row.activated_at,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    deletedAt: row.deleted_at,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class UserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new user row and return the persisted entity (with generated id).
   */
  async insert(entity: Omit<UserEntity, 'id'>): Promise<UserEntity> {
    const sql = `
      INSERT INTO users
        (username, username_normalised, email, password_hash, status,
         registration_timestamp, activated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result: QueryResult<UserRow> = await this.pool.query(sql, [
      entity.username,
      entity.usernameNormalised,
      entity.email,
      entity.passwordHash,
      entity.status,
      entity.registrationTimestamp,
      entity.activatedAt,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up a user by their normalised (lowercased + trimmed) username.
   * Returns null if no match is found.
   */
  async findByNormalisedUsername(normalised: string): Promise<UserEntity | null> {
    const sql = `
      SELECT * FROM users
      WHERE username_normalised = $1
      LIMIT 1
    `;

    const result: QueryResult<UserRow> = await this.pool.query(sql, [normalised]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up a user by their primary key UUID.
   * Returns null if no match is found.
   */
  async findById(id: string): Promise<UserEntity | null> {
    const sql = `
      SELECT * FROM users
      WHERE id = $1
      LIMIT 1
    `;

    const result: QueryResult<UserRow> = await this.pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
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
    const sql = `
      UPDATE users
      SET status = $1, activated_at = $2
      WHERE id = $3
    `;

    await this.pool.query(sql, [status, activatedAt, id]);
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
    const sql = `
      SELECT * FROM users
      WHERE email = $1
      LIMIT 1
    `;

    const result: QueryResult<UserRow> = await this.pool.query(sql, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Increment the consecutive failed-login counter by 1.
   * Called by LoginGuard.registerFailure() on a bad-password attempt.
   */
  async incrementFailedLoginCount(id: string): Promise<void> {
    const sql = `
      UPDATE users
      SET failed_login_count = failed_login_count + 1
      WHERE id = $1
    `;

    await this.pool.query(sql, [id]);
  }

  /**
   * Reset the consecutive failed-login counter to 0.
   * Called on every successful login (FR-009) and when a lockout is applied
   * (the counter restarts clean for the next window).
   */
  async resetFailedLoginCount(id: string): Promise<void> {
    const sql = `
      UPDATE users
      SET failed_login_count = 0
      WHERE id = $1
    `;

    await this.pool.query(sql, [id]);
  }

  /**
   * Apply a temporary lockout by setting locked_until. This is a
   * self-clearing throttle, distinct from `status = 'suspended'`.
   */
  async lockAccount(id: string, lockedUntil: Date): Promise<void> {
    const sql = `
      UPDATE users
      SET locked_until = $1
      WHERE id = $2
    `;

    await this.pool.query(sql, [lockedUntil, id]);
  }

  /**
   * Record the timestamp of a successful login (FR-006).
   */
  async updateLastLoginAt(id: string, timestamp: Date): Promise<void> {
    const sql = `
      UPDATE users
      SET last_login_at = $1
      WHERE id = $2
    `;

    await this.pool.query(sql, [timestamp, id]);
  }

  /**
   * Replace the stored password hash after a successful password reset
   * (FR-014). The plaintext password is never passed to this repository.
   */
  async updatePasswordHash(id: string, hash: string): Promise<void> {
    const sql = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
    `;

    await this.pool.query(sql, [hash, id]);
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
    const sql = `
      UPDATE users
      SET status = 'deleted',
          email = $1,
          username = $2,
          username_normalised = lower($2),
          deleted_at = $3
      WHERE id = $4
    `;

    await this.pool.query(sql, [anonymizedEmail, anonymizedUsername, deletedAt, id]);
  }
}
