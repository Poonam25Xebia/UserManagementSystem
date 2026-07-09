process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.ACTIVATION_BASE_URL = 'https://example.test';
process.env.PASSWORD_RECOVERY_BASE_URL = 'https://example.test';
process.env.PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID = 'd-test-recovery-template';
process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
process.env.ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID = 'd-test-deletion-request-template';
process.env.ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID = 'd-test-deletion-notice-template';

import request from 'supertest';
import express, { Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { Redis } from 'ioredis';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DeliveryResult, EmailRecipient } from '../types/registration.types';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { DefaultSessionService } from '../services/session.service';
import { createSessionValidationMiddleware } from '../middleware/session-validation.middleware';
import { DeletionNotificationRecordRepository } from '../repositories/deletion-notification-record.repository';
import { AccountDeletionNotificationWorker } from '../workers/account-deletion-notification.worker';
import { createTestDb, clearAllTables, closeTestDb, TestDb } from './test-db';

const TEST_PASSWORD = 'Passw0rd!';

/** No-op stand-in — this spec doesn't exercise OTP routes. */
class NoopOtpDeliveryPort implements OtpDeliveryPort {
  async dispatch(): Promise<boolean> {
    return true;
  }
}

/**
 * Captures every dispatched email (deletion-request confirmation, and any
 * post-deletion notice sent by manually invoking the worker) instead of
 * calling a real email provider.
 */
class RecordingEmailDeliveryPort implements EmailDeliveryPort {
  public dispatched: Array<{
    recipient: EmailRecipient;
    subject: string;
    templateId: string;
    templateVars: Record<string, string>;
  }> = [];

  async sendTransactional(
    recipient: EmailRecipient,
    subject: string,
    templateId: string,
    templateVars: Record<string, string>,
  ): Promise<DeliveryResult> {
    this.dispatched.push({ recipient, subject, templateId, templateVars });
    return { success: true };
  }
}

let app: any;
let testDb: TestDb;
let db: Database;
let otpRedisClient: Redis;
let emailDeliveryPort: RecordingEmailDeliveryPort;

/**
 * The plaintext OTP code is never persisted (only its hash is), so tests
 * recover it from the recorded outbound email instead of querying the DB.
 */
function lastDispatchedCode(): string {
  const last = emailDeliveryPort.dispatched[emailDeliveryPort.dispatched.length - 1];
  return last.templateVars.code;
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

  const tokenRow = db
    .prepare('SELECT token_value FROM activation_tokens WHERE user_id = ?')
    .get(userId) as { token_value: string };
  const tokenValue = tokenRow.token_value;

  await request(app).post('/api/v1/users/activate').send({ token: tokenValue }).expect(200);

  return { userId, email: payload.emailAddress, password: payload.password };
}

/** Registers, activates, and logs in, returning the raw session token too. */
async function registerActivateAndLogin(
  overrides: Partial<Record<string, string>> = {},
): Promise<{ userId: string; email: string; password: string; sessionToken: string }> {
  const { userId, email, password } = await registerAndActivateUser(overrides);
  const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  return { userId, email, password, sessionToken: loginResponse.body.token };
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
// 9.1: Request -> confirm happy path
// ---------------------------------------------------------------------------

describe('Integration | Account deletion happy path', () => {
  test('register, activate, log in, request deletion, confirm — user row anonymized and marked deleted', async () => {
    const { userId, sessionToken } = await registerActivateAndLogin();

    const requestResponse = await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);
    expect(requestResponse.body).toHaveProperty('message');

    const requestRow = db
      .prepare('SELECT status FROM account_deletion_requests WHERE user_id = ?')
      .get(userId) as { status: string };
    expect(requestRow.status).toBe('pending');
    const code = lastDispatchedCode();

    const confirmResponse = await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code })
      .expect(200);
    expect(confirmResponse.body.userId).toBe(userId);
    expect(confirmResponse.body).toHaveProperty('deletedAt');

    const userRow = db
      .prepare('SELECT status, deleted_at, email, username, username_normalised FROM users WHERE id = ?')
      .get(userId) as {
        status: string;
        deleted_at: string | null;
        email: string;
        username: string;
        username_normalised: string;
      };
    expect(userRow.status).toBe('deleted');
    expect(userRow.deleted_at).not.toBeNull();
    expect(userRow.email).toBe(`deleted-${userId}@deleted.invalid`);
    expect(userRow.username).toBe(`deleted-user-${userId}`);
    expect(userRow.username_normalised).toBe(`deleted-user-${userId}`.toLowerCase());

    const confirmedRequestRow = db
      .prepare('SELECT status, confirmed_at FROM account_deletion_requests WHERE user_id = ?')
      .get(userId) as { status: string; confirmed_at: string | null };
    expect(confirmedRequestRow.status).toBe('confirmed');
    expect(confirmedRequestRow.confirmed_at).not.toBeNull();

    const notificationRow = db
      .prepare('SELECT recipient_address, delivery_status FROM account_deletion_notification_records WHERE user_id = ?')
      .get(userId) as { recipient_address: string; delivery_status: string };
    expect(notificationRow).toBeDefined();
    expect(notificationRow.delivery_status).toBe('queued');
  });
});

// ---------------------------------------------------------------------------
// 9.2: Session invalidation on deletion
// ---------------------------------------------------------------------------

describe('Integration | Session invalidation on deletion', () => {
  test('a session token issued before deletion is invalidated by confirmDeletion and rejected afterward', async () => {
    const { userId, sessionToken } = await registerActivateAndLogin();

    await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);

    const code = lastDispatchedCode();

    await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code })
      .expect(200);

    // confirmDeletion invalidates every session for the user directly, in
    // the same transaction — so the presented token is now INVALIDATED, not
    // merely rejected for an inactive account (that broadened check exists
    // as defense-in-depth for any session this explicit UPDATE might miss).
    const { app: protectedApp } = buildProtectedTestApp();
    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(401);

    expect(response.body.error_code).toBe('SESSION_INVALIDATED');

    const sessionRows = db
      .prepare('SELECT invalidated FROM sessions WHERE user_id = ?')
      .all(userId) as Array<{ invalidated: number }>;
    expect(sessionRows.length).toBeGreaterThan(0);
    for (const row of sessionRows) {
      expect(row.invalidated).toBe(1);
    }
  });

  test('a still-active session presented against an already-deleted account is rejected by the broadened status cascade', async () => {
    const { userId, email, password } = await registerAndActivateUser();

    // Simulate a session created before deletion whose row somehow escaped
    // confirmDeletion's own UPDATE (e.g. a race) by inserting one directly
    // AFTER the account is already 'deleted', so its `invalidated` flag is
    // false and only the broadened `status !== 'active'` check can catch it.
    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const sessionToken = loginResponse.body.token;
    db.prepare("UPDATE users SET status = 'deleted', deleted_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      userId,
    );

    const { app: protectedApp } = buildProtectedTestApp();
    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(403);

    expect(response.body.error_code).toBe('AUTH_ACCOUNT_NOT_ACTIVE');

    const sessionRows = db
      .prepare('SELECT invalidated FROM sessions WHERE user_id = ?')
      .all(userId) as Array<{ invalidated: number }>;
    for (const row of sessionRows) {
      expect(row.invalidated).toBe(1);
    }
  });
});

/**
 * Builds a minimal Express app wrapping SessionValidationMiddleware over a
 * dummy protected route, backed by the same database as `app` — mirrors
 * F-03's own `login.integration.spec.ts` harness, since no protected route
 * is mounted in the main app.
 */
function buildProtectedTestApp() {
  const userRepository = new UserRepository(db);
  const sessionRepository = new SessionRepository(db);
  const sessionService = new DefaultSessionService(sessionRepository, userRepository);
  const middleware = createSessionValidationMiddleware(sessionService);

  const protectedApp = express();
  protectedApp.use(express.json());
  protectedApp.get('/protected', middleware, (req: Request, res: Response) => {
    res.status(200).json({ userId: req.userId });
  });

  return { app: protectedApp };
}

// ---------------------------------------------------------------------------
// 9.3: Cancellation, expiry, and conflict paths
// ---------------------------------------------------------------------------

describe('Integration | Cancellation, expiry, and conflict paths', () => {
  test('cancelling a pending request, then confirming with its (now cancelled) code, returns 404 DELETION_REQUEST_NOT_FOUND', async () => {
    const { userId, sessionToken } = await registerActivateAndLogin();

    await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);

    const code = lastDispatchedCode();

    await request(app)
      .delete('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    const cancelledRow = db
      .prepare('SELECT status FROM account_deletion_requests WHERE user_id = ?')
      .get(userId) as { status: string };
    expect(cancelledRow.status).toBe('cancelled');

    const confirmResponse = await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code })
      .expect(404);
    expect(confirmResponse.body.error_code).toBe('DELETION_REQUEST_NOT_FOUND');

    const userRow = db.prepare('SELECT status FROM users WHERE id = ?').get(userId) as { status: string };
    expect(userRow.status).toBe('active');
  });

  test('requesting deletion twice without cancelling returns 409 on the second request', async () => {
    const { sessionToken } = await registerActivateAndLogin();

    await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);

    const secondResponse = await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(409);
    expect(secondResponse.body.error_code).toBe('DELETION_REQUEST_ALREADY_PENDING');
  });

  test('cancelling with no pending request returns 404 DELETION_REQUEST_NOT_FOUND', async () => {
    const { sessionToken } = await registerActivateAndLogin();

    const response = await request(app)
      .delete('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(404);
    expect(response.body.error_code).toBe('DELETION_REQUEST_NOT_FOUND');
  });

  test('an expired confirmation code returns 410 DELETION_OTP_EXPIRED', async () => {
    const { userId, sessionToken } = await registerActivateAndLogin();

    await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);

    const code = lastDispatchedCode();

    const requestRow = db
      .prepare('SELECT id FROM account_deletion_requests WHERE user_id = ?')
      .get(userId) as { id: string };
    db.prepare('UPDATE account_deletion_requests SET expires_at = ? WHERE id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      requestRow.id,
    );

    const response = await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code })
      .expect(410);
    expect(response.body.error_code).toBe('DELETION_OTP_EXPIRED');
  });

  test('confirming with no pending request returns 404 DELETION_REQUEST_NOT_FOUND', async () => {
    const { sessionToken } = await registerActivateAndLogin();

    const response = await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code: '000000' })
      .expect(404);
    expect(response.body.error_code).toBe('DELETION_REQUEST_NOT_FOUND');
  });

  test('confirming a pending request with the wrong code returns 422 DELETION_OTP_INVALID', async () => {
    const { sessionToken } = await registerActivateAndLogin();

    await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);

    const response = await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code: '000000' })
      .expect(422);
    expect(response.body.error_code).toBe('DELETION_OTP_INVALID');
  });
});

// ---------------------------------------------------------------------------
// 9.4: Notification worker
// ---------------------------------------------------------------------------

describe('Integration | Post-deletion notification worker', () => {
  test('a confirmed deletion queues a notification record that the worker successfully dispatches', async () => {
    const { userId, email, sessionToken } = await registerActivateAndLogin();

    await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);

    const code = lastDispatchedCode();

    await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code })
      .expect(200);

    emailDeliveryPort.dispatched = []; // clear the (already-tested) request-confirmation dispatch

    const notificationRecordRepository = new DeletionNotificationRecordRepository(db);
    const worker = new AccountDeletionNotificationWorker(notificationRecordRepository, emailDeliveryPort);
    await worker.processQueuedRecords();

    const recordRow = db
      .prepare('SELECT delivery_status, recipient_address FROM account_deletion_notification_records WHERE user_id = ?')
      .get(userId) as { delivery_status: string; recipient_address: string };
    expect(recordRow.delivery_status).toBe('sent');
    expect(recordRow.recipient_address).toBe(email);

    expect(emailDeliveryPort.dispatched).toHaveLength(1);
    expect(emailDeliveryPort.dispatched[0].recipient.address).toBe(email);
    expect(emailDeliveryPort.dispatched[0].templateId).toBe('d-test-deletion-notice-template');
  });
});

// ---------------------------------------------------------------------------
// 9.5: Cross-feature regression with Registration (F-01) and Login (F-03)
// ---------------------------------------------------------------------------

describe('Integration | Cross-feature regression with Registration (F-01) and Login (F-03)', () => {
  test('after deletion, logging in with the original (now-anonymized) credentials never succeeds', async () => {
    const { email, password, sessionToken } = await registerActivateAndLogin();

    const requestRow = await request(app)
      .post('/api/v1/users/deletion-requests')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(202);
    expect(requestRow.body).toHaveProperty('message');

    const code = lastDispatchedCode();

    await request(app)
      .post('/api/v1/users/deletion-requests/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ code })
      .expect(200);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(401);
    expect(loginResponse.body.error_code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});
