/**
 * token.repository.ts
 *
 * Repository for the `activation_tokens` table.  All queries use parameterised
 * `pg` placeholders — no string interpolation.
 *
 * Requirements: US-073 FR-003; US-074 FR-002, FR-006, FR-011
 */

import { Pool, QueryResult } from 'pg';
import { ActivationToken } from '../types/registration.types';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ITokenRepository {
  insert(token: Omit<ActivationToken, 'id'>): Promise<ActivationToken>;
  findByTokenValue(tokenValue: string): Promise<ActivationToken | null>;
  findByUserId(userId: string): Promise<ActivationToken | null>;
  markConsumed(id: string, consumedAt: Date): Promise<void>;
}

// ---------------------------------------------------------------------------
// Row type returned by pg
// ---------------------------------------------------------------------------

interface TokenRow {
  id: string;
  user_id: string;
  token_value: string;
  issued_at: Date;
  expires_at: Date;
  consumed: boolean;
  consumed_at: Date | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: TokenRow): ActivationToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenValue: row.token_value,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    consumed: row.consumed,
    consumedAt: row.consumed_at,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class TokenRepository implements ITokenRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Insert a new activation token and return the persisted entity (with
   * generated id).
   */
  async insert(token: Omit<ActivationToken, 'id'>): Promise<ActivationToken> {
    const sql = `
      INSERT INTO activation_tokens
        (user_id, token_value, issued_at, expires_at, consumed, consumed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result: QueryResult<TokenRow> = await this.pool.query(sql, [
      token.userId,
      token.tokenValue,
      token.issuedAt,
      token.expiresAt,
      token.consumed,
      token.consumedAt,
    ]);

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up a token by its opaque token_value string.
   * Returns null if not found.
   */
  async findByTokenValue(tokenValue: string): Promise<ActivationToken | null> {
    const sql = `
      SELECT * FROM activation_tokens
      WHERE token_value = $1
      LIMIT 1
    `;

    const result: QueryResult<TokenRow> = await this.pool.query(sql, [tokenValue]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Look up a token by the owning user's UUID.
   * Returns null if not found (one token per user due to UNIQUE constraint).
   */
  async findByUserId(userId: string): Promise<ActivationToken | null> {
    const sql = `
      SELECT * FROM activation_tokens
      WHERE user_id = $1
      LIMIT 1
    `;

    const result: QueryResult<TokenRow> = await this.pool.query(sql, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  /**
   * Mark a token as consumed after successful account activation.
   */
  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    const sql = `
      UPDATE activation_tokens
      SET consumed = true, consumed_at = $1
      WHERE id = $2
    `;

    await this.pool.query(sql, [consumedAt, id]);
  }
}
