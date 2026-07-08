process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
process.env.OTP_MAX_ATTEMPTS_PER_WINDOW = '5';
process.env.OTP_RATE_LIMIT_WINDOW_MINUTES = '15';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.REDIS_URL = REDIS_URL;

import request from 'supertest';
import express, { Express } from 'express';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { createOtpRouter } from '../routes/otp.routes';
import { OtpDeliveryPort } from '../adapters/otp-delivery.port';

let app: Express;
let pool: Pool;
let redis: Redis;
let deliveryPort: RecordingDeliveryPort;

/**
 * Captures every dispatched OTP code instead of calling a real email
 * provider, so tests can assert on delivery behaviour and on what a
 * response never leaks.
 */
class RecordingDeliveryPort implements OtpDeliveryPort {
  public dispatched: Array<{ destination: string; code: string }> = [];
  public nextResult = true;

  async dispatch(destination: string, code: string): Promise<boolean> {
    this.dispatched.push({ destination, code });
    return this.nextResult;
  }
}

async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(255) NOT NULL,
      username_normalised VARCHAR(255) NOT NULL,
      email VARCHAR(320) NOT NULL,
      password_hash VARCHAR(72) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
      registration_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_at TIMESTAMPTZ NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email_address VARCHAR(320) NOT NULL,
      code_hash VARCHAR(256) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      invalidated_at TIMESTAMPTZ NULL,
      attempt_sequence SMALLINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_otp_requests_active_per_user
      ON otp_requests(user_id) WHERE invalidated_at IS NULL
  `);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function insertUser(status: 'pending' | 'active' | 'suspended'): Promise<{ id: string; email: string }> {
  const suffix = randomSuffix();
  const email = `${suffix}@example.test`;
  const result = await pool.query(
    `INSERT INTO users (username, username_normalised, email, password_hash, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email`,
    [`user-${suffix}`, `user-${suffix}`, email, 'irrelevant-hash', status],
  );
  return result.rows[0];
}

beforeAll(async () => {
  pool = new Pool();
  redis = new Redis(REDIS_URL);
  await ensureDatabaseSchema(pool);

  deliveryPort = new RecordingDeliveryPort();

  app = express();
  app.use(express.json());
  app.use('/api/v1/otp', createOtpRouter(pool, redis, deliveryPort));
});

afterEach(() => {
  deliveryPort.dispatched = [];
  deliveryPort.nextResult = true;
});

afterAll(async () => {
  await pool.query('DELETE FROM otp_requests');
  await pool.query('DELETE FROM users');
  await redis.quit();
  await pool.end();
});

describe('Integration | OTP send and resend', () => {
  test('POST /api/v1/otp/send happy path accepts and delivers to an active user', async () => {
    const user = await insertUser('active');

    const response = await request(app)
      .post('/api/v1/otp/send')
      .send({ userId: user.id })
      .expect(202);

    expect(response.body).toEqual({ status: 'accepted' });
    expect(deliveryPort.dispatched).toHaveLength(1);
    expect(deliveryPort.dispatched[0].destination).toBe(user.email);

    const dispatchedCode = deliveryPort.dispatched[0].code;
    expect(dispatchedCode).toMatch(/^\d{6}$/);
    expect(JSON.stringify(response.body)).not.toContain(dispatchedCode);

    const otpRow = await pool.query(
      'SELECT status, email_address, code_hash FROM otp_requests WHERE user_id = $1',
      [user.id],
    );
    expect(otpRow.rowCount).toBe(1);
    expect(otpRow.rows[0].status).toBe('delivered');
    expect(otpRow.rows[0].email_address).toBe(user.email);
    expect(otpRow.rows[0].code_hash).not.toBe(dispatchedCode);

    await redis.del(`otp:rl:${user.id}`);
  });

  test('POST /api/v1/otp/resend happy path invalidates the prior OTP and issues a new one', async () => {
    const user = await insertUser('active');

    await request(app).post('/api/v1/otp/send').send({ userId: user.id }).expect(202);
    const firstCode = deliveryPort.dispatched[0].code;

    const response = await request(app)
      .post('/api/v1/otp/resend')
      .send({ userId: user.id })
      .expect(202);

    expect(response.body).toEqual({ status: 'accepted' });
    const secondCode = deliveryPort.dispatched[1].code;
    expect(secondCode).not.toBe(firstCode);

    const rows = await pool.query(
      'SELECT invalidated_at FROM otp_requests WHERE user_id = $1 ORDER BY created_at ASC',
      [user.id],
    );
    expect(rows.rowCount).toBe(2);
    expect(rows.rows[0].invalidated_at).not.toBeNull();
    expect(rows.rows[1].invalidated_at).toBeNull();

    await redis.del(`otp:rl:${user.id}`);
  });

  test('POST /api/v1/otp/send accepts a pending user (post-registration activation)', async () => {
    const user = await insertUser('pending');

    const response = await request(app)
      .post('/api/v1/otp/send')
      .send({ userId: user.id })
      .expect(202);

    expect(response.body).toEqual({ status: 'accepted' });
    expect(deliveryPort.dispatched).toHaveLength(1);

    await redis.del(`otp:rl:${user.id}`);
  });

  test('POST /api/v1/otp/send returns 403 for a suspended user', async () => {
    const user = await insertUser('suspended');

    const response = await request(app)
      .post('/api/v1/otp/send')
      .send({ userId: user.id })
      .expect(403);

    expect(response.body.errorCode).toBe('OTP_FORBIDDEN');
    expect(deliveryPort.dispatched).toHaveLength(0);
  });

  test('POST /api/v1/otp/send returns 429 once the rate limit window is exceeded', async () => {
    const user = await insertUser('active');

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/otp/send').send({ userId: user.id }).expect(202);
    }

    const response = await request(app)
      .post('/api/v1/otp/send')
      .send({ userId: user.id })
      .expect(429);

    expect(response.body.errorCode).toBe('OTP_RATE_LIMIT_EXCEEDED');

    await redis.del(`otp:rl:${user.id}`);
  });

  test('never returns the plaintext OTP in the response body, even on dispatch failure', async () => {
    const user = await insertUser('active');
    deliveryPort.nextResult = false;

    const response = await request(app)
      .post('/api/v1/otp/send')
      .send({ userId: user.id })
      .expect(202);

    expect(response.body).toEqual({ status: 'dispatch_failed' });
    const dispatchedCode = deliveryPort.dispatched[0].code;
    expect(JSON.stringify(response.body)).not.toContain(dispatchedCode);

    await redis.del(`otp:rl:${user.id}`);
  });
});

describe('Integration | OTP verify', () => {
  test('POST /api/v1/otp/verify activates a pending user on the correct code', async () => {
    const user = await insertUser('pending');
    await request(app).post('/api/v1/otp/send').send({ userId: user.id }).expect(202);
    const code = deliveryPort.dispatched[deliveryPort.dispatched.length - 1].code;

    const response = await request(app)
      .post('/api/v1/otp/verify')
      .send({ userId: user.id, passcode: code })
      .expect(200);

    expect(response.body).toMatchObject({ userId: user.id });

    const userRow = await pool.query('SELECT status, activated_at FROM users WHERE id = $1', [user.id]);
    expect(userRow.rows[0].status).toBe('active');
    expect(userRow.rows[0].activated_at).not.toBeNull();

    const otpRow = await pool.query('SELECT invalidated_at FROM otp_requests WHERE user_id = $1', [user.id]);
    expect(otpRow.rows[0].invalidated_at).not.toBeNull();

    await redis.del(`otp:rl:${user.id}`);
  });

  test('POST /api/v1/otp/verify returns 422 for an incorrect code', async () => {
    const user = await insertUser('pending');
    await request(app).post('/api/v1/otp/send').send({ userId: user.id }).expect(202);

    const response = await request(app)
      .post('/api/v1/otp/verify')
      .send({ userId: user.id, passcode: '000000' })
      .expect(422);

    expect(response.body.errorCode).toBe('OTP_INVALID');

    await redis.del(`otp:rl:${user.id}`);
  });

  test('POST /api/v1/otp/verify returns 404 when no OTP has been requested', async () => {
    const user = await insertUser('pending');

    const response = await request(app)
      .post('/api/v1/otp/verify')
      .send({ userId: user.id, passcode: '123456' })
      .expect(404);

    expect(response.body.errorCode).toBe('OTP_NOT_FOUND');
  });

  test('POST /api/v1/otp/verify returns 410 for an expired OTP', async () => {
    const user = await insertUser('pending');
    await request(app).post('/api/v1/otp/send').send({ userId: user.id }).expect(202);
    const code = deliveryPort.dispatched[deliveryPort.dispatched.length - 1].code;

    await pool.query(
      `UPDATE otp_requests SET expires_at = NOW() - INTERVAL '1 second' WHERE user_id = $1`,
      [user.id],
    );

    const response = await request(app)
      .post('/api/v1/otp/verify')
      .send({ userId: user.id, passcode: code })
      .expect(410);

    expect(response.body.errorCode).toBe('OTP_EXPIRED');

    await redis.del(`otp:rl:${user.id}`);
  });
});
