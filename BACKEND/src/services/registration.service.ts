/**
 * registration.service.ts
 *
 * User registration service — inserts the new `users` row. Account
 * activation is now handled by the OTP feature (see `OtpService.sendOtp`,
 * invoked by `RegistrationController` after this resolves) rather than the
 * email-link flow this service previously wrote `activation_tokens` /
 * `registration_email_records` rows for.
 *
 * Requirements: US-073 FR-001–004, FR-006–007, FR-010
 *
 * Security notes:
 *   - `dto.password` (plaintext) is hashed via bcrypt and then NEVER stored,
 *     logged, or returned. Only `passwordHash` is persisted.
 *   - bcrypt cost factor is read from `appConfig.bcryptCostFactor`, which is
 *     guaranteed ≥ 12 by the config loader.
 */

import bcrypt from 'bcrypt';
import { Pool, PoolClient } from 'pg';
import { RegistrationRequestDto, UserCreatedResult } from '../types/registration.types';
import { UsernameConflictError } from '../errors/registration.errors';
import { appConfig } from '../config/app.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RegistrationService {
  register(dto: RegistrationRequestDto): Promise<UserCreatedResult>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultRegistrationService implements RegistrationService {
  constructor(private readonly pool: Pool) {}

  /**
   * Creates a new user in `pending` status. Account activation (OTP send)
   * is triggered by the caller (`RegistrationController`) once this resolves.
   *
   * @param dto - Validated registration payload (validation is the caller's
   *              responsibility — see RegistrationController).
   * @returns    `UserCreatedResult` containing the new user's UUID and a
   *             human-readable confirmation message.
   * @throws     Re-throws any pg / bcrypt errors after issuing ROLLBACK.
   */
  async register(dto: RegistrationRequestDto): Promise<UserCreatedResult> {
    // -----------------------------------------------------------------------
    // 1. Hash password — plaintext is done with after this line
    // -----------------------------------------------------------------------
    const passwordHash = await bcrypt.hash(dto.password, appConfig.bcryptCostFactor);

    // -----------------------------------------------------------------------
    // 2. Normalise username (case-insensitive, leading/trailing whitespace removed)
    // -----------------------------------------------------------------------
    const usernameNormalised = dto.username.trim().toLowerCase();
    const now = new Date();

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // --- INSERT user ---
      const userResult = await client.query(
        `INSERT INTO users (username, username_normalised, email, password_hash, status, registration_timestamp, activated_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, NULL)
         RETURNING id`,
        [dto.username, usernameNormalised, dto.emailAddress, passwordHash, now],
      );
      const userId: string = userResult.rows[0].id;

      await client.query('COMMIT');

      return {
        userId,
        message: 'Registration successful. Please check your email for the verification code to activate your account.',
      };
    } catch (err) {
      await client.query('ROLLBACK');

      if (isUsernameConflictError(err)) {
        throw new UsernameConflictError(usernameNormalised);
      }

      throw err;
    } finally {
      client.release();
    }
  }
}

function isUsernameConflictError(err: unknown): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505' &&
    'constraint' in err &&
    (err as { constraint?: string }).constraint === 'uidx_users_username_normalised'
  );
}
