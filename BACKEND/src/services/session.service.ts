/**
 * session.service.ts
 *
 * Owns the full session lifecycle for the User Login Feature (F-03):
 * creation, validation, and invalidation.
 *
 * Session tokens are 256-bit values from crypto.randomBytes(32), hex-encoded.
 * Only SHA-256(rawToken) is ever persisted (sessions.token_hash) — the raw
 * token is returned to the caller exactly once, on creation, and is never
 * logged or stored anywhere.
 *
 * Requirements: US-038 FR-001–010, EC-001–EC-006
 */

import crypto from 'crypto';
import { ISessionRepository } from '../repositories/session.repository';
import { IUserRepository } from '../repositories/user.repository';
import { LogoutResult, SessionValidationResult } from '../types/login.types';
import { sessionConfig } from '../config/session.config';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SessionService {
  createSession(userId: string): Promise<{ rawToken: string; expiresAt: Date }>;
  validateSession(rawToken: string): Promise<SessionValidationResult>;
  invalidateSession(rawToken: string): Promise<LogoutResult>;
  invalidateAllForUser(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 256 bits of cryptographically random data, hex-encoded (FR-009). */
function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** SHA-256 hex digest of the raw token — the only form ever persisted. */
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultSessionService implements SessionService {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly userRepository: IUserRepository,
    private readonly sessionExpirySeconds: number = sessionConfig.sessionExpirySeconds,
  ) {}

  /**
   * Create a new session for the given user and return the raw token.
   * The raw token is never persisted — only its SHA-256 hash is written to
   * the `sessions` table (FR-001, FR-002, FR-008, FR-009).
   */
  async createSession(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.sessionExpirySeconds * 1000);

    await this.sessionRepository.insert(userId, tokenHash, createdAt, expiresAt);

    return { rawToken, expiresAt };
  }

  /**
   * Validate a presented raw token. Never throws for a missing / expired /
   * invalidated token — callers switch on the typed result instead (EC-001,
   * EC-004–EC-006 are all "no session" outcomes, not exceptions).
   *
   * If the owning user's account is no longer 'active' (suspended, per
   * EC-003, or — as of F-04 — soft-deleted via account deletion), this call
   * has a side effect: every session for that user is invalidated before
   * returning `valid: false` — this status enforcement is lazy, at the next
   * point of use, rather than by a separate sweep. The `reason` literal
   * remains `'ACCOUNT_SUSPENDED'` for both causes (design.md F-04
   * Requirements Reconciliation/Data Models only calls for broadening the
   * *check*, not introducing a new reason/HTTP code — both map to the same
   * 403 AUTH_ACCOUNT_NOT_ACTIVE either way).
   */
  async validateSession(rawToken: string): Promise<SessionValidationResult> {
    const tokenHash = hashToken(rawToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (session === null) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    if (new Date() >= session.expiresAt) {
      return { valid: false, reason: 'EXPIRED' };
    }

    if (session.invalidated) {
      return { valid: false, reason: 'INVALIDATED' };
    }

    const user = await this.userRepository.findById(session.userId);
    if (user !== null && user.status !== 'active') {
      await this.sessionRepository.invalidateAllForUser(user.id);
      return { valid: false, reason: 'ACCOUNT_SUSPENDED' };
    }

    return { valid: true, userId: session.userId };
  }

  /**
   * Invalidate a single session (logout). Idempotent by design: a token that
   * is not found, already invalidated, or already expired is treated as
   * "already terminated" rather than an error (EC-005) — callers should
   * always respond 200 regardless of which branch is taken.
   */
  async invalidateSession(rawToken: string): Promise<LogoutResult> {
    const tokenHash = hashToken(rawToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (
      session === null ||
      session.invalidated ||
      new Date() >= session.expiresAt
    ) {
      return { alreadyTerminated: true };
    }

    await this.sessionRepository.markInvalidated(session.id, new Date());
    return { alreadyTerminated: false };
  }

  /**
   * Bulk-invalidate every still-active session for a user. Used on account
   * suspension (EC-003, via validateSession above) and on password reset
   * (FR-018, via PasswordRecoveryService).
   */
  async invalidateAllForUser(userId: string): Promise<void> {
    await this.sessionRepository.invalidateAllForUser(userId);
  }
}
