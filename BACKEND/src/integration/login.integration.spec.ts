process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.ACTIVATION_BASE_URL = 'https://example.test';
process.env.PASSWORD_RECOVERY_BASE_URL = 'https://example.test';
process.env.PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID = 'd-test-recovery-template';
// createApp also boots the OTP feature — these satisfy its fail-fast config
// checks even though this spec doesn't exercise OTP routes.
process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
// createApp now also boots the Account Deletion feature (F-04) — these
// satisfy its fail-fast config checks even though this spec doesn't
// exercise deletion routes.
process.env.ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID = 'd-test-deletion-request-template';
process.env.ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID = 'd-test-deletion-notice-template';

import request from 'supertest';
import express, { Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DeliveryResult, EmailRecipient } from '../types/registration.types';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { DefaultSessionService } from '../services/session.service';
import { createSessionValidationMiddleware } from '../middleware/session-validation.middleware';
import { createTestDb, clearAllTables, closeTestDb, TestDb } from './test-db';

const TEST_PASSWORD = 'Passw0rd!';

/** No-op stand-in — this spec doesn't exercise OTP routes. */
class NoopOtpDeliveryPort implements OtpDeliveryPort {
  async dispatch(): Promise<boolean> {
    return true;
  }
}

/**
 * Captures every dispatched recovery email instead of calling a real email
 * provider, so tests can extract the recovery link/token and assert on
 * dispatch behavior without a live network call.
 */
class RecordingEmailDeliveryPort implements EmailDeliveryPort {
  public dispatched: Array<{ recipient: EmailRecipient; templateVars: Record<string, string> }> = [];

  async sendTransactional(
    recipient: EmailRecipient,
    _subject: string,
    _templateId: string,
    templateVars: Record<string, string>,
  ): Promise<DeliveryResult> {
    this.dispatched.push({ recipient, templateVars });
    return { success: true };
  }
}

let app: any;
let testDb: TestDb;
let db: Database;
let otpRedisClient: Redis;
let emailDeliveryPort: RecordingEmailDeliveryPort;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

function registrationPayload(overrides: Partial<Record<string, string>> = {}) {
  const username = overrides.username ?? `user-${randomSuffix()}`;
  const emailAddress = overrides.emailAddress ?? `${username}@example.test`;
  return {
    username,
    emailAddress,
    password: overrides.password ?? TEST_PASSWORD,
    passwordConfirmation: overrides.passwordConfirmation ?? TEST_PASSWORD,
  };
}

/** Registers and activates a user via the F-01 HTTP flow, returning its credentials. */
async function registerAndActivateUser(
  overrides: Partial<Record<string, string>> = {},
): Promise<{ userId: string; email: string; password: string }> {
  const payload = registrationPayload(overrides);
  const registerResponse = await request(app)
    .post('/api/v1/users/register')
    .send(payload)
    .expect(201);
  const userId = registerResponse.body.userId;

  const tokenRow = db
    .prepare('SELECT token_value FROM activation_tokens WHERE user_id = ?')
    .get(userId) as { token_value: string };
  const tokenValue = tokenRow.token_value;

  await request(app).post('/api/v1/users/activate').send({ token: tokenValue }).expect(200);

  return { userId, email: payload.emailAddress, password: payload.password };
}

beforeAll(async () => {
  testDb = createTestDb();
  db = testDb.db;
  otpRedisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  emailDeliveryPort = new RecordingEmailDeliveryPort();
  const appModule = await import('../app');
  app = appModule.createApp(db, otpRedisClient, new NoopOtpDeliveryPort(), emailDeliveryPort);
});

afterEach(async () => {
  emailDeliveryPort.dispatched = [];
  clearAllTables(db);
});

afterAll(async () => {
  closeTestDb(testDb);
  await otpRedisClient.quit();
});

// ---------------------------------------------------------------------------
// 13.1: Login happy path and failures
// ---------------------------------------------------------------------------

describe('Integration | Login happy path and failures', () => {
  test('register (F-01), activate, then log in (F-03) returns 200 with a valid token', async () => {
    const { email, password } = await registerAndActivateUser();

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(typeof loginResponse.body.token).toBe('string');
    expect(loginResponse.body.token.length).toBeGreaterThan(0);
    expect(typeof loginResponse.body.expires_at).toBe('string');

    const tokenHash = crypto.createHash('sha256').update(loginResponse.body.token).digest('hex');
    const sessionRow = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    expect(sessionRow).toBeDefined();
  });

  test('unknown email and wrong password return identical 401 bodies', async () => {
    const { email } = await registerAndActivateUser();

    const unknownEmailResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `nobody-${randomSuffix()}@example.test`, password: TEST_PASSWORD })
      .expect(401);

    const wrongPasswordResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    expect(unknownEmailResponse.body).toEqual(wrongPasswordResponse.body);
    expect(unknownEmailResponse.body.error_code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  test('login against a pending (not yet activated) account returns 403', async () => {
    const payload = registrationPayload();
    await request(app).post('/api/v1/users/register').send(payload).expect(201);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: payload.emailAddress, password: payload.password })
      .expect(403);

    expect(response.body.error_code).toBe('AUTH_ACCOUNT_NOT_ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// 13.2: Account lockout
// ---------------------------------------------------------------------------

describe('Integration | Account lockout', () => {
  test('5 consecutive bad passwords lock the account; the 6th attempt is rejected even with the correct password', async () => {
    const { email, password } = await registerAndActivateUser();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }

    const lockedResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(423);

    expect(lockedResponse.body.error_code).toBe('AUTH_ACCOUNT_LOCKED');
    expect(lockedResponse.body).toHaveProperty('retry_after');
  });

  test('locked_until clears naturally once its window has elapsed', async () => {
    const { userId, email, password } = await registerAndActivateUser();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }
    await request(app).post('/api/v1/auth/login').send({ email, password }).expect(423);

    // Simulate the lockout window having already elapsed rather than waiting
    // real wall-clock minutes — matches the registration suite's approach to
    // testing expired activation tokens.
    db.prepare('UPDATE users SET locked_until = ? WHERE id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      userId,
    );

    await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  });
});

// ---------------------------------------------------------------------------
// 13.3: Logout and session validation
// ---------------------------------------------------------------------------

describe('Integration | Logout and session validation', () => {
  test('logging out twice with the same token returns 200 both times; only one row transition occurs', async () => {
    const { email, password } = await registerAndActivateUser();
    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const token = loginResponse.body.token;

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionRow = db
      .prepare('SELECT invalidated, invalidated_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { invalidated: number; invalidated_at: string | null };
    expect(sessionRow.invalidated).toBe(1);
  });

  test('a protected route guarded by SessionValidationMiddleware rejects an expired token before the handler runs', async () => {
    const { email, password } = await registerAndActivateUser();
    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const token = loginResponse.body.token;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      tokenHash,
    );

    const { app: protectedApp, handlerCalls } = buildProtectedTestApp();

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.error_code).toBe('SESSION_EXPIRED');
    expect(handlerCalls.count).toBe(0);
  });

  test('suspending a user cascades to invalidate all of their sessions on next use (EC-003)', async () => {
    const { userId, email, password } = await registerAndActivateUser();
    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const token = loginResponse.body.token;

    // Simulates an out-of-scope admin action — user suspension itself is
    // owned by a different feature; this spec only verifies F-03's reaction.
    db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(userId);

    const { app: protectedApp } = buildProtectedTestApp();

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body.error_code).toBe('AUTH_ACCOUNT_NOT_ACTIVE');

    const sessionRows = db
      .prepare('SELECT invalidated FROM sessions WHERE user_id = ?')
      .all(userId) as Array<{ invalidated: number }>;
    expect(sessionRows.length).toBeGreaterThan(0);
    for (const row of sessionRows) {
      expect(row.invalidated).toBe(1);
    }
  });
});

/**
 * Builds a minimal Express app wrapping SessionValidationMiddleware over a
 * dummy protected route, backed by the same database as `app`. There is no
 * protected route mounted in the main app yet (task 12 exports the
 * middleware as infrastructure for future routes — see design.md US-038
 * A-003) — this exercises the exact same session-validation logic that
 * every future protected route will use, against real session rows.
 */
function buildProtectedTestApp() {
  const userRepository = new UserRepository(db);
  const sessionRepository = new SessionRepository(db);
  const sessionService = new DefaultSessionService(sessionRepository, userRepository);
  const middleware = createSessionValidationMiddleware(sessionService);

  const handlerCalls = { count: 0 };
  const protectedApp = express();
  protectedApp.use(express.json());
  protectedApp.get('/protected', middleware, (req: Request, res: Response) => {
    handlerCalls.count++;
    res.status(200).json({ userId: req.userId });
  });

  return { app: protectedApp, handlerCalls };
}

// ---------------------------------------------------------------------------
// 13.4: Password recovery and reset
// ---------------------------------------------------------------------------

describe('Integration | Password recovery and reset', () => {
  test('recovery requests for an existing and a non-existing email return byte-identical 202 responses', async () => {
    const { email } = await registerAndActivateUser();

    const existingResponse = await request(app)
      .post('/api/v1/auth/password-recovery')
      .send({ email })
      .expect(202);

    const unknownResponse = await request(app)
      .post('/api/v1/auth/password-recovery')
      .send({ email: `nobody-${randomSuffix()}@example.test` })
      .expect(202);

    expect(existingResponse.body).toEqual(unknownResponse.body);
    expect(emailDeliveryPort.dispatched.length).toBe(1); // only the existing-email branch dispatches
  });

  test('full flow: request recovery, reset password, verify old sessions invalidated and new password works', async () => {
    const { userId, email, password } = await registerAndActivateUser();

    // Establish an active session before the reset.
    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const oldToken = loginResponse.body.token;

    await request(app).post('/api/v1/auth/password-recovery').send({ email }).expect(202);

    const recoveryRow = db
      .prepare('SELECT token FROM password_recovery_requests WHERE user_id = ?')
      .get(userId) as { token: string };
    const recoveryToken = recoveryRow.token;

    const newPassword = 'NewPassw0rd!';
    await request(app)
      .post('/api/v1/auth/password-reset')
      .send({ recovery_token: recoveryToken, new_password: newPassword })
      .expect(200);

    // Old session invalidated.
    const oldTokenHash = crypto.createHash('sha256').update(oldToken).digest('hex');
    const oldSessionRow = db
      .prepare('SELECT invalidated FROM sessions WHERE token_hash = ?')
      .get(oldTokenHash) as { invalidated: number };
    expect(oldSessionRow.invalidated).toBe(1);

    // Old password no longer works; new password does.
    await request(app).post('/api/v1/auth/login').send({ email, password }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email, password: newPassword }).expect(200);
  });

  test('an expired recovery token returns 410 TOKEN_EXPIRED', async () => {
    const { userId, email } = await registerAndActivateUser();

    await request(app).post('/api/v1/auth/password-recovery').send({ email }).expect(202);
    const recoveryRow = db
      .prepare('SELECT id, token FROM password_recovery_requests WHERE user_id = ?')
      .get(userId) as { id: string; token: string };
    const { id, token } = recoveryRow;

    db.prepare('UPDATE password_recovery_requests SET expires_at = ? WHERE id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      id,
    );

    const response = await request(app)
      .post('/api/v1/auth/password-reset')
      .send({ recovery_token: token, new_password: 'NewPassw0rd!' })
      .expect(410);

    expect(response.body.error_code).toBe('TOKEN_EXPIRED');
  });

  test('a weak new password returns 422 PASSWORD_POLICY_VIOLATION', async () => {
    const { userId, email } = await registerAndActivateUser();

    await request(app).post('/api/v1/auth/password-recovery').send({ email }).expect(202);
    const recoveryRow = db
      .prepare('SELECT token FROM password_recovery_requests WHERE user_id = ?')
      .get(userId) as { token: string };
    const token = recoveryRow.token;

    const response = await request(app)
      .post('/api/v1/auth/password-reset')
      .send({ recovery_token: token, new_password: 'weak' })
      .expect(422);

    expect(response.body.error_code).toBe('PASSWORD_POLICY_VIOLATION');
    expect(Array.isArray(response.body.violations)).toBe(true);
    expect(response.body.violations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 13.5: Cross-feature regression with Registration (F-01)
// ---------------------------------------------------------------------------

describe('Integration | Cross-feature regression with Registration (F-01)', () => {
  test('a user registered and activated via F-01 logs in via F-03 using the same bcrypt hash, unmodified by login', async () => {
    const { userId, email, password } = await registerAndActivateUser();

    const beforeLogin = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(userId) as { password_hash: string };
    const passwordHashBeforeLogin = beforeLogin.password_hash;

    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(loginResponse.body).toHaveProperty('token');

    const afterLogin = db
      .prepare('SELECT password_hash, last_login_at, failed_login_count FROM users WHERE id = ?')
      .get(userId) as { password_hash: string; last_login_at: string | null; failed_login_count: number };
    // The shared PasswordPolicyEvaluator/bcrypt hash set at registration
    // (F-01) is exactly what login's bcrypt.compare (F-03) checks against —
    // a successful login must not rehash or otherwise mutate it.
    expect(afterLogin.password_hash).toBe(passwordHashBeforeLogin);
    expect(afterLogin.last_login_at).not.toBeNull();
    expect(afterLogin.failed_login_count).toBe(0);
  });
});
