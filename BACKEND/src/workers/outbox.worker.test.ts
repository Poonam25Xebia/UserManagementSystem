process.env.ACTIVATION_BASE_URL = 'https://app.example.test';
process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.FROM_EMAIL = 'noreply@example.test';
process.env.PASSWORD_RECOVERY_BASE_URL = 'https://app.example.test';
process.env.PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID = 'd-test-recovery-template';
process.env.OUTBOX_MAX_RETRIES = '1';
delete process.env.OUTBOX_LOGGING_ENABLED;

import { Console } from 'console';
import { Writable } from 'stream';
import { OutboxWorker } from './outbox.worker';
import { EmailRecordRepository, IEmailRecordRepository } from '../repositories/email-record.repository';
import { ITokenRepository } from '../repositories/token.repository';
import { IUserRepository } from '../repositories/user.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { ActivationToken, RegistrationEmailRecord, UserEntity } from '../types/registration.types';
import { appConfig } from '../config/app.config';
import { createTestDb, closeTestDb, TestDb } from '../integration/test-db';

const RECIPIENT = 'jdoe.secret@example.test';
const USERNAME = 'JaneDoeSecretName';
const SUBJECT = 'Activate your account';
const TOKEN_VALUE = 'tok-secret-value';

function buildRecord(overrides: Partial<RegistrationEmailRecord> = {}): RegistrationEmailRecord {
  return {
    recordId: 'record-1',
    userId: 'user-1',
    recipientAddress: RECIPIENT,
    dispatchTimestamp: new Date('2026-01-01T00:00:00.000Z'),
    deliveryStatus: 'queued',
    retryCount: 0,
    activationTokenId: 'token-1',
    ...overrides,
  };
}

function buildUser(id = 'user-1'): UserEntity {
  return {
    id,
    username: USERNAME,
    usernameNormalised: USERNAME.toLowerCase(),
    email: RECIPIENT,
    passwordHash: 'hash',
    status: 'pending',
    registrationTimestamp: new Date('2026-01-01T00:00:00.000Z'),
    activatedAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    deletedAt: null,
  };
}

function buildToken(userId = 'user-1'): ActivationToken {
  return {
    id: 'token-1',
    userId,
    tokenValue: TOKEN_VALUE,
    issuedAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-02T00:00:00.000Z'),
    consumed: false,
    consumedAt: null,
  };
}

/** Replaces the global console with a real Console writing to in-memory streams. */
function captureConsole(): { stdout: () => string; stderr: () => string; restore: () => void } {
  const out: string[] = [];
  const err: string[] = [];
  const sink = (buf: string[]): Writable =>
    new Writable({
      write(chunk, _enc, cb) {
        buf.push(chunk.toString());
        cb();
      },
    });
  const original = global.console;
  global.console = new Console({ stdout: sink(out), stderr: sink(err) });
  return {
    stdout: () => out.join(''),
    stderr: () => err.join(''),
    restore: () => {
      global.console = original;
    },
  };
}

function parseLines(raw: string): Array<Record<string, unknown>> {
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function byEvent(entries: Array<Record<string, unknown>>, event: string): Array<Record<string, unknown>> {
  return entries.filter((e) => e.event === event);
}

function expectValidRecordEntry(entry: Record<string, unknown>): void {
  expect(typeof entry.record_id).toBe('string');
  expect(['sent', 'retry_scheduled', 'failed']).toContain(entry.outcome);
  expect(Number.isInteger(entry.retry_count)).toBe(true);
  expect(Number.isInteger(entry.duration_ms)).toBe(true);
  expect(entry.duration_ms as number).toBeGreaterThanOrEqual(0);
}

describe('OutboxWorker structured logging', () => {
  let emailRecordRepository: jest.Mocked<IEmailRecordRepository>;
  let tokenRepository: jest.Mocked<ITokenRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let emailDeliveryPort: jest.Mocked<EmailDeliveryPort>;
  let worker: OutboxWorker;
  let captured: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    emailRecordRepository = {
      insert: jest.fn(),
      findByStatus: jest.fn(),
      findByUserId: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      incrementRetryCount: jest.fn().mockResolvedValue(undefined),
      countByStatus: jest.fn(),
    };
    tokenRepository = {
      findByUserId: jest.fn().mockImplementation(async (userId: string) => buildToken(userId)),
    } as unknown as jest.Mocked<ITokenRepository>;
    userRepository = {
      findById: jest.fn().mockImplementation(async (id: string) => buildUser(id)),
    } as unknown as jest.Mocked<IUserRepository>;
    emailDeliveryPort = { sendTransactional: jest.fn() };
    worker = new OutboxWorker(emailRecordRepository, tokenRepository, userRepository, emailDeliveryPort);
    captured = captureConsole();
  });

  afterEach(() => {
    captured.restore();
  });

  test('logging is enabled by default', () => {
    expect(appConfig.outboxLoggingEnabled).toBe(true);
  });

  test('successful send emits one poll-depth entry and one sent record entry', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(1);
    emailRecordRepository.findByStatus.mockResolvedValue([buildRecord()]);
    emailDeliveryPort.sendTransactional.mockResolvedValue({ success: true });

    await worker.processQueuedRecords();

    expect(emailRecordRepository.countByStatus).toHaveBeenCalledTimes(1);
    expect(emailRecordRepository.countByStatus).toHaveBeenCalledWith('queued');
    const entries = parseLines(captured.stdout());
    const depth = byEvent(entries, 'outbox.poll.depth');
    expect(depth).toHaveLength(1);
    expect(depth[0].queued_count).toBe(1);
    expect(depth[0].poll_interval_ms).toBe(appConfig.outboxPollIntervalMs);

    const processed = byEvent(entries, 'outbox.record.processed');
    expect(processed).toHaveLength(1);
    expectValidRecordEntry(processed[0]);
    expect(processed[0]).toMatchObject({ record_id: 'record-1', outcome: 'sent', retry_count: 0 });
    expect(emailRecordRepository.updateStatus).toHaveBeenCalledWith('record-1', 'sent');
  });

  test('transient send failure logs retry_scheduled with the incremented retry_count', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(1);
    emailRecordRepository.findByStatus.mockResolvedValue([buildRecord({ retryCount: 0 })]);
    emailDeliveryPort.sendTransactional.mockResolvedValue({ success: false, error: 'provider 503' });

    await worker.processQueuedRecords();

    expect(emailRecordRepository.incrementRetryCount).toHaveBeenCalledWith('record-1');
    const processed = byEvent(parseLines(captured.stdout()), 'outbox.record.processed');
    expect(processed).toHaveLength(1);
    expectValidRecordEntry(processed[0]);
    expect(processed[0]).toMatchObject({ outcome: 'retry_scheduled', retry_count: 1 });
  });

  test('terminal send failure logs failed with the unchanged retry_count', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(1);
    emailRecordRepository.findByStatus.mockResolvedValue([
      buildRecord({ retryCount: appConfig.outboxMaxRetries }),
    ]);
    emailDeliveryPort.sendTransactional.mockResolvedValue({ success: false, error: 'bounced' });

    await worker.processQueuedRecords();

    expect(emailRecordRepository.updateStatus).toHaveBeenCalledWith('record-1', 'failed');
    expect(emailRecordRepository.incrementRetryCount).not.toHaveBeenCalled();
    const processed = byEvent(parseLines(captured.stdout()), 'outbox.record.processed');
    expect(processed).toHaveLength(1);
    expect(processed[0]).toMatchObject({ outcome: 'failed', retry_count: appConfig.outboxMaxRetries });
  });

  test('send that throws still emits exactly one record entry with a duration', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(2);
    emailRecordRepository.findByStatus.mockResolvedValue([
      buildRecord({ recordId: 'record-retry', userId: 'user-1', retryCount: 0 }),
      buildRecord({ recordId: 'record-fail', userId: 'user-2', retryCount: appConfig.outboxMaxRetries }),
    ]);
    emailDeliveryPort.sendTransactional.mockRejectedValue(new Error(`boom for ${RECIPIENT}`));

    await worker.processQueuedRecords();

    const processed = byEvent(parseLines(captured.stdout()), 'outbox.record.processed');
    expect(processed).toHaveLength(2);
    processed.forEach(expectValidRecordEntry);
    expect(processed[0]).toMatchObject({ record_id: 'record-retry', outcome: 'retry_scheduled', retry_count: 1 });
    expect(processed[1]).toMatchObject({ record_id: 'record-fail', outcome: 'failed' });
  });

  test('missing token/user logs a failed record entry', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(1);
    emailRecordRepository.findByStatus.mockResolvedValue([buildRecord()]);
    tokenRepository.findByUserId.mockResolvedValue(null);

    await worker.processQueuedRecords();

    expect(emailDeliveryPort.sendTransactional).not.toHaveBeenCalled();
    const processed = byEvent(parseLines(captured.stdout()), 'outbox.record.processed');
    expect(processed).toHaveLength(1);
    expect(processed[0]).toMatchObject({ record_id: 'record-1', outcome: 'failed', retry_count: 0 });
  });

  test('multiple records: one poll-depth entry and one record entry per attempt', async () => {
    const records = ['a', 'b', 'c'].map((id, i) =>
      buildRecord({ recordId: `record-${id}`, userId: `user-${id}`, retryCount: 0 + (i === 2 ? 1 : 0) }),
    );
    emailRecordRepository.countByStatus.mockResolvedValue(records.length);
    emailRecordRepository.findByStatus.mockResolvedValue(records);
    emailDeliveryPort.sendTransactional
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'transient' })
      .mockResolvedValueOnce({ success: false, error: 'terminal' });

    await worker.processQueuedRecords();

    const entries = parseLines(captured.stdout());
    expect(byEvent(entries, 'outbox.poll.depth')).toHaveLength(1);
    expect(byEvent(entries, 'outbox.poll.depth')[0].queued_count).toBe(3);
    const processed = byEvent(entries, 'outbox.record.processed');
    expect(processed.map((e) => [e.record_id, e.outcome, e.retry_count])).toEqual([
      ['record-a', 'sent', 0],
      ['record-b', 'retry_scheduled', 1],
      ['record-c', 'failed', 1],
    ]);
    processed.forEach(expectValidRecordEntry);
  });

  test('a later attempt on the same record produces a new entry', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(1);
    emailRecordRepository.findByStatus
      .mockResolvedValueOnce([buildRecord({ retryCount: 0 })])
      .mockResolvedValueOnce([buildRecord({ retryCount: 1 })]);
    emailDeliveryPort.sendTransactional
      .mockResolvedValueOnce({ success: false, error: 'transient' })
      .mockResolvedValueOnce({ success: true });

    await worker.processQueuedRecords();
    await worker.processQueuedRecords();

    const entries = parseLines(captured.stdout());
    expect(byEvent(entries, 'outbox.poll.depth')).toHaveLength(2);
    expect(byEvent(entries, 'outbox.record.processed').map((e) => e.outcome)).toEqual([
      'retry_scheduled',
      'sent',
    ]);
  });

  test('empty queue emits only a poll-depth entry with queued_count 0', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(0);
    emailRecordRepository.findByStatus.mockResolvedValue([]);

    await worker.processQueuedRecords();

    const entries = parseLines(captured.stdout());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ event: 'outbox.poll.depth', queued_count: 0 });
  });

  test('every emitted line is single-line JSON with only whitelisted keys and no recipient data', async () => {
    emailRecordRepository.countByStatus.mockResolvedValue(3);
    emailRecordRepository.findByStatus.mockResolvedValue([
      buildRecord({ recordId: 'r1', userId: 'u1' }),
      buildRecord({ recordId: 'r2', userId: 'u2' }),
      buildRecord({ recordId: 'r3', userId: 'u3', retryCount: 5 }),
    ]);
    emailDeliveryPort.sendTransactional
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: `rejected ${RECIPIENT}` })
      .mockRejectedValueOnce(new Error('network'));

    await worker.processQueuedRecords();

    const raw = captured.stdout();
    const lines = raw.split('\n').filter((l) => l !== '');
    expect(lines).toHaveLength(4);
    const allowedKeys = new Set([
      'event', 'timestamp', 'worker_id', 'queued_count', 'poll_interval_ms',
      'record_id', 'outcome', 'retry_count', 'duration_ms',
    ]);
    for (const line of lines) {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      Object.keys(parsed).forEach((key) => expect(allowedKeys.has(key)).toBe(true));
      for (const forbidden of ['recipient', 'recipientAddress', 'email', 'subject', 'body', 'message', 'name']) {
        expect(parsed).not.toHaveProperty(forbidden);
      }
    }
    for (const secret of [RECIPIENT, USERNAME, SUBJECT, TOKEN_VALUE]) {
      expect(raw).not.toContain(secret);
    }
  });

  test('start() records the configured poll interval in poll-depth entries', async () => {
    jest.useFakeTimers();
    try {
      emailRecordRepository.countByStatus.mockResolvedValue(0);
      emailRecordRepository.findByStatus.mockResolvedValue([]);
      worker.start(1234);
      jest.advanceTimersByTime(1234);
      worker.stop();
    } finally {
      jest.useRealTimers();
    }
    await new Promise((resolve) => setImmediate(resolve));

    const depth = byEvent(parseLines(captured.stdout()), 'outbox.poll.depth');
    expect(depth).toHaveLength(1);
    expect(depth[0].poll_interval_ms).toBe(1234);
  });
});

describe('OutboxWorker structured logging with a real repository', () => {
  let testDb: TestDb;
  let captured: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    testDb = createTestDb();
    captured = captureConsole();
  });

  afterEach(() => {
    captured.restore();
    closeTestDb(testDb);
  });

  test('queued_count equals the DB count of queued records', async () => {
    const { db } = testDb;
    const insertUser = db.prepare(
      `INSERT INTO users (id, username, username_normalised, email, password_hash, registration_timestamp)
       VALUES (?, ?, ?, ?, 'hash', '2026-01-01T00:00:00.000Z')`,
    );
    const repo = new EmailRecordRepository(db);
    const statuses: Array<'queued' | 'sent' | 'failed'> = ['queued', 'queued', 'queued', 'sent', 'failed'];
    for (const [i, status] of statuses.entries()) {
      insertUser.run(`user-${i}`, `user${i}`, `user${i}`, `user${i}@example.test`);
      await repo.insert({
        userId: `user-${i}`,
        recipientAddress: `user${i}@example.test`,
        dispatchTimestamp: new Date(Date.UTC(2026, 0, 1, 0, i)),
        deliveryStatus: status,
        retryCount: 0,
        activationTokenId: null as unknown as string,
      });
    }

    const tokenRepository = {
      findByUserId: jest.fn().mockImplementation(async (userId: string) => buildToken(userId)),
    } as unknown as ITokenRepository;
    const userRepository = {
      findById: jest.fn().mockImplementation(async (id: string) => buildUser(id)),
    } as unknown as IUserRepository;
    const emailDeliveryPort: EmailDeliveryPort = {
      sendTransactional: jest.fn().mockResolvedValue({ success: false, error: 'transient' }),
    };
    const worker = new OutboxWorker(repo, tokenRepository, userRepository, emailDeliveryPort);

    await worker.processQueuedRecords();

    const entries = parseLines(captured.stdout());
    const depth = byEvent(entries, 'outbox.poll.depth');
    expect(depth).toHaveLength(1);
    expect(depth[0].queued_count).toBe(3);

    const processed = byEvent(entries, 'outbox.record.processed');
    expect(processed).toHaveLength(3);
    for (const entry of processed) {
      expect(entry.outcome).toBe('retry_scheduled');
      const row = db
        .prepare('SELECT retry_count FROM registration_email_records WHERE record_id = ?')
        .get(entry.record_id) as { retry_count: number };
      expect(entry.retry_count).toBe(row.retry_count);
    }
    expect(captured.stdout()).not.toContain('@example.test');
  });
});
