process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.ACTIVATION_BASE_URL = 'https://example.test';
// createApp now also boots the OTP feature (task 7) — these satisfy its
// fail-fast config checks even though this spec doesn't exercise OTP routes.
process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
// createApp now also boots the Account Deletion feature (F-04) — these
// satisfy its fail-fast config checks even though this spec doesn't
// exercise deletion routes.
process.env.ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID = 'd-test-deletion-request-template';
process.env.ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID = 'd-test-deletion-notice-template';

import request from 'supertest';
import type { Database } from 'better-sqlite3';
import { Redis } from 'ioredis';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DeliveryResult, EmailRecipient } from '../types/registration.types';
import { createTestDb, clearAllTables, closeTestDb, TestDb } from './test-db';

const TEST_PASSWORD = 'Passw0rd!';

/**
 * Captures every dispatched OTP code so registration → activation tests can
 * submit the real code back to POST /api/v1/otp/verify.
 */
class RecordingOtpDeliveryPort implements OtpDeliveryPort {
  public dispatched: Array<{ destination: string; code: string }> = [];

  async dispatch(destination: string, code: string): Promise<boolean> {
    this.dispatched.push({ destination, code });
    return true;
  }

  codeFor(destination: string): string {
    const match = [...this.dispatched].reverse().find((entry) => entry.destination === destination);
    if (!match) {
      throw new Error(`No OTP was dispatched to ${destination}`);
    }
    return match.code;
  }
}

/** No-op stand-in — this spec doesn't exercise password-recovery routes. */
class NoopEmailDeliveryPort implements EmailDeliveryPort {
  async sendTransactional(
    _recipient: EmailRecipient,
    _subject: string,
    _templateId: string,
    _templateVars: Record<string, string>,
  ): Promise<DeliveryResult> {
    return { success: true };
  }
}

let app: any;
let testDb: TestDb;
let db: Database;
let otpRedisClient: Redis;
let otpDeliveryPort: RecordingOtpDeliveryPort;

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

beforeAll(async () => {
  testDb = createTestDb();
  db = testDb.db;
  otpRedisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  otpDeliveryPort = new RecordingOtpDeliveryPort();
  const appModule = await import('../app');
  app = appModule.createApp(db, otpRedisClient, otpDeliveryPort, new NoopEmailDeliveryPort());
});

afterEach(async () => {
  clearAllTables(db);
  otpDeliveryPort.dispatched = [];
});

afterAll(async () => {
  closeTestDb(testDb);
  await otpRedisClient.quit();
});

describe('Integration | Registration and activation', () => {
  test('POST /api/v1/users/register happy path creates a pending user and dispatches an OTP email', async () => {
    const payload = registrationPayload();
    const response = await request(app)
      .post('/api/v1/users/register')
      .send(payload)
      .expect(201);

    expect(response.body).toHaveProperty('userId');
    const userId = response.body.userId;

    const userRow = db
      .prepare('SELECT username, email, status FROM users WHERE id = ?')
      .get(userId) as { username: string; email: string; status: string } | undefined;
    expect(userRow).toMatchObject({
      username: payload.username,
      email: payload.emailAddress,
      status: 'pending',
    });

    const otpRow = db
      .prepare('SELECT status, expires_at, created_at FROM otp_requests WHERE user_id = ?')
      .get(userId) as { status: string } | undefined;
    expect(otpRow).toBeDefined();
    expect(otpRow!.status).toBe('delivered');

    expect(otpDeliveryPort.dispatched).toHaveLength(1);
    expect(otpDeliveryPort.dispatched[0].destination).toBe(payload.emailAddress);
    expect(otpDeliveryPort.dispatched[0].code).toMatch(/^\d{6}$/);
  });

  test('POST /api/v1/users/register returns 422 for missing mandatory fields', async () => {
    const response = await request(app)
      .post('/api/v1/users/register')
      .send({ emailAddress: 'missing@example.test' })
      .expect(422);

    expect(Array.isArray(response.body.fieldErrors)).toBe(true);
    const fields = response.body.fieldErrors.map((item: any) => item.fieldName);
    expect(fields).toEqual(expect.arrayContaining(['username', 'password', 'passwordConfirmation']));
  });

  test('POST /api/v1/users/register returns 409 for duplicate username case-insensitively', async () => {
    const basePayload = registrationPayload({ username: `duplicate-${randomSuffix()}` });
    await request(app).post('/api/v1/users/register').send(basePayload).expect(201);

    const secondPayload = registrationPayload({
      username: basePayload.username.toUpperCase(),
      emailAddress: `other-${randomSuffix()}@example.test`,
    });

    await request(app).post('/api/v1/users/register').send(secondPayload).expect(409);
  });

  test('POST /api/v1/users/register returns 422 for password policy violation', async () => {
    const payload = registrationPayload({ password: 'weak', passwordConfirmation: 'weak' });

    const response = await request(app)
      .post('/api/v1/users/register')
      .send(payload)
      .expect(422);

    expect(response.body).toHaveProperty('error', 'PASSWORD_POLICY_VIOLATION');
    expect(Array.isArray(response.body.violations)).toBe(true);
    expect(response.body.violations.length).toBeGreaterThan(0);
  });

  test('POST /api/v1/users/register returns 422 for invalid email format', async () => {
    const payload = registrationPayload({ emailAddress: 'not-an-email' });

    const response = await request(app)
      .post('/api/v1/users/register')
      .send(payload)
      .expect(422);

    expect(Array.isArray(response.body.fieldErrors)).toBe(true);
    expect(response.body.fieldErrors.some((item: any) => item.fieldName === 'emailAddress')).toBe(true);
  });

  test('Concurrent duplicate username registration results in one success and one conflict', async () => {
    const username = `race-${randomSuffix()}`;
    const payload1 = registrationPayload({ username, emailAddress: `${username}@example.test` });
    const payload2 = registrationPayload({ username: username.toUpperCase(), emailAddress: `other-${randomSuffix()}@example.test` });

    const results = await Promise.allSettled([
      request(app).post('/api/v1/users/register').send(payload1),
      request(app).post('/api/v1/users/register').send(payload2),
    ]);

    const statuses = results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value.status;
      }
      return 500;
    });

    expect(statuses.sort()).toEqual([201, 409]);
  });

  test('POST /api/v1/otp/verify activates the user and consumes the OTP', async () => {
    const payload = registrationPayload();
    const registerResponse = await request(app)
      .post('/api/v1/users/register')
      .send(payload)
      .expect(201);

    const userId = registerResponse.body.userId;
    const code = otpDeliveryPort.codeFor(payload.emailAddress);

    const verifyResponse = await request(app)
      .post('/api/v1/otp/verify')
      .send({ userId, passcode: code })
      .expect(200);

    expect(verifyResponse.body).toHaveProperty('userId', userId);

    const userRow = db
      .prepare('SELECT status, activated_at FROM users WHERE id = ?')
      .get(userId) as { status: string; activated_at: string | null };
    expect(userRow.status).toBe('active');
    expect(userRow.activated_at).not.toBeNull();

    const otpRow = db
      .prepare('SELECT invalidated_at FROM otp_requests WHERE user_id = ?')
      .get(userId) as { invalidated_at: string | null };
    expect(otpRow.invalidated_at).not.toBeNull();
  });

  test('POST /api/v1/otp/verify returns 410 for an expired OTP', async () => {
    const payload = registrationPayload();
    const registerResponse = await request(app)
      .post('/api/v1/users/register')
      .send(payload)
      .expect(201);

    const userId = registerResponse.body.userId;
    const code = otpDeliveryPort.codeFor(payload.emailAddress);

    db.prepare('UPDATE otp_requests SET expires_at = ? WHERE user_id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      userId,
    );

    const verifyResponse = await request(app)
      .post('/api/v1/otp/verify')
      .send({ userId, passcode: code })
      .expect(410);

    expect(verifyResponse.body.errorCode).toBe('OTP_EXPIRED');
  });
});
