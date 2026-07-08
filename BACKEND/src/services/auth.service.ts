/**
 * auth.service.ts
 *
 * Orchestrates credential verification, failed-attempt bookkeeping, lockout
 * enforcement, and session issuance for POST /api/v1/auth/login.
 *
 * Sequence (per design.md):
 *  1. Find user by email          -> InvalidCredentialsException if not found (no enumeration)
 *  2. Check lockout                -> AccountLockedException if locked
 *  3. Check account status         -> AccountNotActiveException if not 'active'
 *  4. Compare password (bcrypt)    -> constant-time
 *  5. On mismatch                  -> registerFailure, then InvalidCredentialsException
 *  6. On match                     -> reset counter, record last login, create session
 *  7. Session persistence failure  -> SessionCreationFailedException (EC-006)
 *
 * Requirements: US-036 FR-001–009; US-039 FR-001–009, EC-004, EC-006
 */

import { IUserRepository } from '../repositories/user.repository';
import { PasswordHasher } from './password-hasher';
import { LoginGuard } from './login-guard';
import { SessionService } from './session.service';
import { LoginResult } from '../types/login.types';
import {
  InvalidCredentialsException,
  AccountNotActiveException,
  SessionCreationFailedException,
} from '../errors/login.errors';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AuthService {
  login(email: string, password: string): Promise<LoginResult>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class DefaultAuthService implements AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly loginGuard: LoginGuard,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * @throws InvalidCredentialsException    - unknown email, or wrong password (identical for both — FR-002, EC-004)
   * @throws AccountLockedException         - locked_until is still in the future
   * @throws AccountNotActiveException      - account status is not 'active'
   * @throws SessionCreationFailedException - session persistence failed after credentials verified (EC-006)
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // --- Step 1: Look up user (FR-002) ---
    const user = await this.userRepository.findByEmail(email);
    if (user === null) {
      throw new InvalidCredentialsException();
    }

    // --- Step 2: Lockout check ---
    this.loginGuard.checkLockout(user);

    // --- Step 3: Account status check (FR-003) ---
    if (user.status !== 'active') {
      throw new AccountNotActiveException(user.status);
    }

    // --- Step 4: Password comparison (FR-004) ---
    const passwordMatches = await this.passwordHasher.compare(password, user.passwordHash);
    if (!passwordMatches) {
      // --- Step 5: Record failure, possibly lock the account ---
      await this.loginGuard.registerFailure(user);
      throw new InvalidCredentialsException();
    }

    // --- Step 6: Success bookkeeping (FR-006, FR-009) ---
    await this.userRepository.resetFailedLoginCount(user.id);
    await this.userRepository.updateLastLoginAt(user.id, new Date());

    // --- Step 7: Session creation (FR-005), with EC-006 handling ---
    try {
      const { rawToken, expiresAt } = await this.sessionService.createSession(user.id);
      return { token: rawToken, expiresAt };
    } catch {
      throw new SessionCreationFailedException();
    }
  }
}
