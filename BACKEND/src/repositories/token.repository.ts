/**
 * token.repository.ts
 *
 * Repository for the `activation_tokens` table.  All queries use parameterised
 * `?` placeholders — no string interpolation.
 *
 * Requirements: US-073 FR-003; US-074 FR-002, FR-006, FR-011
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
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
// Row type returned by better-sqlite3
// ---------------------------------------------------------------------------

interface TokenRow {
  id: string;
  user_id: string;
  token_value: string;
  issued_at: string;
  expires_at: string;
  consumed: number;
  consumed_at: string | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function rowToEntity(row: TokenRow): ActivationToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenValue: row.token_value,
    issuedAt: new Date(row.issued_at),
    expiresAt: new Date(row.expires_at),
    consumed: row.consumed === 1,
    consumedAt: row.consumed_at === null ? null : new Date(row.consumed_at),
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class TokenRepository implements ITokenRepository {
  constructor(private readonly db: Database) {}

  /**
   * Insert a new activation token and return the persisted entity (with
   * generated id).
   */
  async insert(token: Omit<ActivationToken, 'id'>): Promise<ActivationToken> {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO activation_tokens
          (id, user_id, token_value, issued_at, expires_at, consumed, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        token.userId,
        token.tokenValue,
        token.issuedAt.toISOString(),
        token.expiresAt.toISOString(),
        token.consumed ? 1 : 0,
        token.consumedAt === null ? null : token.consumedAt.toISOString(),
      );

    const row = this.db
      .prepare('SELECT * FROM activation_tokens WHERE id = ?')
      .get(id) as TokenRow;
    return rowToEntity(row);
  }

  /**
   * Look up a token by its opaque token_value string.
   * Returns null if not found.
   */
  async findByTokenValue(tokenValue: string): Promise<ActivationToken | null> {
    const row = this.db
      .prepare('SELECT * FROM activation_tokens WHERE token_value = ? LIMIT 1')
      .get(tokenValue) as TokenRow | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Look up a token by the owning user's UUID.
   * Returns null if not found (one token per user due to UNIQUE constraint).
   */
  async findByUserId(userId: string): Promise<ActivationToken | null> {
    const row = this.db
      .prepare('SELECT * FROM activation_tokens WHERE user_id = ? LIMIT 1')
      .get(userId) as TokenRow | undefined;

    return row === undefined ? null : rowToEntity(row);
  }

  /**
   * Mark a token as consumed after successful account activation.
   */
  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    this.db
      .prepare('UPDATE activation_tokens SET consumed = 1, consumed_at = ? WHERE id = ?')
      .run(consumedAt.toISOString(), id);
  }
}
