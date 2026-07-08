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
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DeliveryResult, EmailRecipient } from '../types/registration.types';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { DefaultSessionService } from '../services/session.service';
import { createSessionValidationMiddleware } from '../middleware/session-validation.middleware';

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
let pool: Pool;
let otpRedisClient: Redis;
let emailDeliveryPort: RecordingEmailDeliveryPort;

async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(255) NOT NULL,
      username_normalised VARCHAR(255) NOT NULL,
      email VARCHAR(320) NOT NULL,
      password_hash VARCHAR(72) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
      registration_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_at TIMESTAMPTZ NULL,
      failed_login_count SMALLINT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ NULL,
      last_login_at TIMESTAMPTZ NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activation_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token_value VARCHAR(128) NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT FALSE,
      consumed_at TIMESTAMPTZ NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS registration_email_records (
      record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      recipient_address VARCHAR(320) NOT NULL,
      dispatch_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      delivery_status VARCHAR(10) NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'failed')),
      retry_count SMALLINT NOT NULL DEFAULT 0,
      activation_token_id UUID REFERENCES activation_tokens(id) ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      invalidated BOOLEAN NOT NULL DEFAULT FALSE,
      invalidated_at TIMESTAMPTZ NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_recovery_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(128) NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed BOOLEAN NOT NULL DEFAULT FALSE,
      consumed_at TIMESTAMPTZ NULL
    )
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_users_username_normalised ON users(username_normalised)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_users_email ON users(email)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_activation_tokens_token_value ON activation_tokens(token_value)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_sessions_token_hash ON sessions(token_hash)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_prr_token ON password_recovery_requests(token)`);
}

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

  const tokenResult = await pool.query(
    'SELECT token_value FROM activation_tokens WHERE user_id = $1',
    [userId],
  );
  const tokenValue = tokenResult.rows[0].token_value;

  await request(app).post('/api/v1/users/activate').send({ token: tokenValue }).expect(200);

  return { userId, email: payload.emailAddress, password: payload.password };
}

async function clearTables(): Promise<void> {
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM password_recovery_requests');
  await pool.query('DELETE FROM registration_email_records');
  await pool.query('DELETE FROM activation_tokens');
  await pool.query('DELETE FROM users');
}

beforeAll(async () => {
  pool = new Pool();
  otpRedisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  emailDeliveryPort = new RecordingEmailDeliveryPort();
  await ensureDatabaseSchema(pool);
  const appModule = await import('../app');
  app = appModule.createApp(pool, otpRedisClient, new NoopOtpDeliveryPort(), emailDeliveryPort);
});

afterEach(async () => {
  emailDeliveryPort.dispatched = [];
  await clearTables();
});

afterAll(async () => {
  await pool.end();
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
    const sessionRow = await pool.query('SELECT * FROM sessions WHERE token_hash = $1', [tokenHash]);
    expect(sessionRow.rowCount).toBe(1);
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
    await pool.query(
      `UPDATE users SET locked_until = NOW() - INTERVAL '1 second' WHERE id = $1`,
      [userId],
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
    const sessionRow = await pool.query(
      'SELECT invalidated, invalidated_at FROM sessions WHERE token_hash = $1',
      [tokenHash],
    );
    expect(sessionRow.rowCount).toBe(1);
    expect(sessionRow.rows[0].invalidated).toBe(true);
  });

  test('a protected route guarded by SessionValidationMiddleware rejects an expired token before the handler runs', async () => {
    const { email, password } = await registerAndActivateUser();
    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const token = loginResponse.body.token;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query(`UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = $1`, [tokenHash]);

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
    await pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [userId]);

    const { app: protectedApp } = buildProtectedTestApp();

    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body.error_code).toBe('AUTH_ACCOUNT_NOT_ACTIVE');

    const sessionRows = await pool.query('SELECT invalidated FROM sessions WHERE user_id = $1', [userId]);
    expect(sessionRows.rowCount).toBeGreaterThan(0);
    for (const row of sessionRows.rows) {
      expect(row.invalidated).toBe(true);
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
  const userRepository = new UserRepository(pool);
  const sessionRepository = new SessionRepository(pool);
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

    const recoveryRow = await pool.query(
      'SELECT token FROM password_recovery_requests WHERE user_id = $1',
      [userId],
    );
    expect(recoveryRow.rowCount).toBe(1);
    const recoveryToken = recoveryRow.rows[0].token;

    const newPassword = 'NewPassw0rd!';
    await request(app)
      .post('/api/v1/auth/password-reset')
      .send({ recovery_token: recoveryToken, new_password: newPassword })
      .expect(200);

    // Old session invalidated.
    const oldTokenHash = crypto.createHash('sha256').update(oldToken).digest('hex');
    const oldSessionRow = await pool.query('SELECT invalidated FROM sessions WHERE token_hash = $1', [oldTokenHash]);
    expect(oldSessionRow.rows[0].invalidated).toBe(true);

    // Old password no longer works; new password does.
    await request(app).post('/api/v1/auth/login').send({ email, password }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email, password: newPassword }).expect(200);
  });

  test('an expired recovery token returns 410 TOKEN_EXPIRED', async () => {
    const { userId, email } = await registerAndActivateUser();

    await request(app).post('/api/v1/auth/password-recovery').send({ email }).expect(202);
    const recoveryRow = await pool.query(
      'SELECT id, token FROM password_recovery_requests WHERE user_id = $1',
      [userId],
    );
    const { id, token } = recoveryRow.rows[0];

    await pool.query(`UPDATE password_recovery_requests SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1`, [id]);

    const response = await request(app)
      .post('/api/v1/auth/password-reset')
      .send({ recovery_token: token, new_password: 'NewPassw0rd!' })
      .expect(410);

    expect(response.body.error_code).toBe('TOKEN_EXPIRED');
  });

  test('a weak new password returns 422 PASSWORD_POLICY_VIOLATION', async () => {
    const { userId, email } = await registerAndActivateUser();

    await request(app).post('/api/v1/auth/password-recovery').send({ email }).expect(202);
    const recoveryRow = await pool.query(
      'SELECT token FROM password_recovery_requests WHERE user_id = $1',
      [userId],
    );
    const token = recoveryRow.rows[0].token;

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

    const beforeLogin = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const passwordHashBeforeLogin = beforeLogin.rows[0].password_hash;

    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(loginResponse.body).toHaveProperty('token');

    const afterLogin = await pool.query(
      'SELECT password_hash, last_login_at, failed_login_count FROM users WHERE id = $1',
      [userId],
    );
    // The shared PasswordPolicyEvaluator/bcrypt hash set at registration
    // (F-01) is exactly what login's bcrypt.compare (F-03) checks against —
    // a successful login must not rehash or otherwise mutate it.
    expect(afterLogin.rows[0].password_hash).toBe(passwordHashBeforeLogin);
    expect(afterLogin.rows[0].last_login_at).not.toBeNull();
    expect(afterLogin.rows[0].failed_login_count).toBe(0);
  });
});
