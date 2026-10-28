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
import { IEmailRecordRepository } from '../repositories/email-record.repository';
import { ITokenRepository } from '../repositories/token.repository';
import { IUserRepository } from '../repositories/user.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import {
  ActivationToken,
  RegistrationEmailRecord,
  UserEntity,
} from '../types/registration.types';

const RECIPIENT = 'jdoe.secret@example.test';
const USERNAME = 'jdoe-display-name';
const SUBJECT = 'Activate your account';

// ---------------------------------------------------------------------------
// Real stdout/stderr capture: route the global console through a Node Console
// bound to in-memory streams, so assertions run against the exact bytes the
// worker writes (not against mocked helper calls).
// ---------------------------------------------------------------------------

interface Capture {
  stdout: string[];
  stderr: string[];
}

function sink(chunks: string[]): Writable {
  return new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
}

let capture: Capture;
let originalConsole: Console;

beforeEach(() => {
  capture = { stdout: [], stderr: [] };
  originalConsole = global.console;
  global.console = new Console({ stdout: sink(capture.stdout), stderr: sink(capture.stderr) });
});

afterEach(() => {
  global.console = originalConsole;
});

function stdoutLines(): string[] {
  return capture.stdout.join('').split('\n').filter((line) => line.length > 0);
}

function jsonEntries(): Array<Record<string, unknown>> {
  return stdoutLines()
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function entriesFor(event: string): Array<Record<string, unknown>> {
  return jsonEntries().filter((e) => e.event === event);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildRecord(overrides: Partial<RegistrationEmailRecord> = {}): RegistrationEmailRecord {
  return {
    recordId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    userId: 'user-1',
    recipientAddress: RECIPIENT,
    dispatchTimestamp: new Date('2026-01-01T00:00:00.000Z'),
    deliveryStatus: 'queued',
    retryCount: 0,
    activationTokenId: 'token-1',
    ...overrides,
  };
}

const token: ActivationToken = {
  id: 'token-1',
  userId: 'user-1',
  tokenValue: 'tok-value',
  issuedAt: new Date(),
  expiresAt: new Date(),
  consumed: false,
  consumedAt: null,
};

const user = { id: 'user-1', username: USERNAME, email: RECIPIENT } as UserEntity;

function setup(records: RegistrationEmailRecord[], queuedCount = records.length) {
  const emailRecordRepository: jest.Mocked<IEmailRecordRepository> = {
    insert: jest.fn(),
    findByStatus: jest.fn().mockResolvedValue(records),
    findByUserId: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    incrementRetryCount: jest.fn().mockResolvedValue(undefined),
    countByStatus: jest.fn().mockResolvedValue(queuedCount),
  };
  const tokenRepository = {
    findByUserId: jest.fn().mockResolvedValue(token),
  } as unknown as jest.Mocked<ITokenRepository>;
  const userRepository = {
    findById: jest.fn().mockResolvedValue(user),
  } as unknown as jest.Mocked<IUserRepository>;
  const emailDeliveryPort: jest.Mocked<EmailDeliveryPort> = {
    sendTransactional: jest.fn().mockResolvedValue({ success: true }),
  };
  const worker = new OutboxWorker(
    emailRecordRepository,
    tokenRepository,
    userRepository,
    emailDeliveryPort,
  );
  return { worker, emailRecordRepository, tokenRepository, userRepository, emailDeliveryPort };
}

function expectValidRecordEntry(entry: Record<string, unknown>): void {
  expect(typeof entry.record_id).toBe('string');
  expect(['sent', 'retry_scheduled', 'failed']).toContain(entry.outcome);
  expect(Number.isInteger(entry.retry_count)).toBe(true);
  expect(Number.isInteger(entry.duration_ms)).toBe(true);
  expect(entry.duration_ms as number).toBeGreaterThanOrEqual(0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OutboxWorker structured logging', () => {
  test('successful send emits one poll-depth entry and one sent record entry', async () => {
    const record = buildRecord({ retryCount: 0 });
    const { worker, emailRecordRepository } = setup([record], 1);

    await worker.processQueuedRecords();

    expect(emailRecordRepository.countByStatus).toHaveBeenCalledTimes(1);
    expect(emailRecordRepository.countByStatus).toHaveBeenCalledWith('queued');
    expect(emailRecordRepository.updateStatus).toHaveBeenCalledWith(record.recordId, 'sent');

    const depth = entriesFor('outbox.poll.depth');
    expect(depth).toHaveLength(1);
    expect(depth[0].queued_count).toBe(1);
    expect(depth[0].poll_interval_ms).toBe(30_000);

    const processed = entriesFor('outbox.record.processed');
    expect(processed).toHaveLength(1);
    expectValidRecordEntry(processed[0]);
    expect(processed[0]).toMatchObject({
      record_id: record.recordId,
      outcome: 'sent',
      retry_count: 0,
    });
  });

  test('transient failure logs retry_scheduled with the incremented retry_count', async () => {
    const record = buildRecord({ retryCount: 0 });
    const { worker, emailRecordRepository, emailDeliveryPort } = setup([record]);
    emailDeliveryPort.sendTransactional.mockResolvedValue({ success: false, error: 'timeout' });

    await worker.processQueuedRecords();

    expect(emailRecordRepository.incrementRetryCount).toHaveBeenCalledWith(record.recordId);
    expect(emailRecordRepository.updateStatus).not.toHaveBeenCalled();

    const processed = entriesFor('outbox.record.processed');
    expect(processed).toHaveLength(1);
    expectValidRecordEntry(processed[0]);
    expect(processed[0]).toMatchObject({ outcome: 'retry_scheduled', retry_count: 1 });
  });

  test('failure at max retries logs failed and keeps the stored retry_count', async () => {
    const record = buildRecord({ retryCount: 1 });
    const { worker, emailRecordRepository, emailDeliveryPort } = setup([record]);
    emailDeliveryPort.sendTransactional.mockResolvedValue({ success: false, error: 'bounced' });

    await worker.processQueuedRecords();

    expect(emailRecordRepository.updateStatus).toHaveBeenCalledWith(record.recordId, 'failed');
    expect(emailRecordRepository.incrementRetryCount).not.toHaveBeenCalled();

    const processed = entriesFor('outbox.record.processed');
    expect(processed).toHaveLength(1);
    expect(processed[0]).toMatchObject({ outcome: 'failed', retry_count: 1 });
  });

  test('thrown send error still emits exactly one record entry with a duration', async () => {
    const retryable = buildRecord({ recordId: 'rec-retry', userId: 'user-1', retryCount: 0 });
    const terminal = buildRecord({ recordId: 'rec-terminal', userId: 'user-2', retryCount: 1 });
    const { worker, emailDeliveryPort } = setup([retryable, terminal]);
    emailDeliveryPort.sendTransactional.mockRejectedValue(new Error('socket hang up'));

    await worker.processQueuedRecords();

    const processed = entriesFor('outbox.record.processed');
    expect(processed).toHaveLength(2);
    processed.forEach(expectValidRecordEntry);
    expect(processed[0]).toMatchObject({ record_id: 'rec-retry', outcome: 'retry_scheduled', retry_count: 1 });
    expect(processed[1]).toMatchObject({ record_id: 'rec-terminal', outcome: 'failed', retry_count: 1 });
  });

  test('missing token/user logs failed for that attempt', async () => {
    const record = buildRecord();
    const { worker, tokenRepository, emailRecordRepository } = setup([record]);
    tokenRepository.findByUserId.mockResolvedValue(null);

    await worker.processQueuedRecords();

    expect(emailRecordRepository.updateStatus).toHaveBeenCalledWith(record.recordId, 'failed');
    const processed = entriesFor('outbox.record.processed');
    expect(processed).toHaveLength(1);
    expect(processed[0]).toMatchObject({ outcome: 'failed', retry_count: 0 });
  });

  test('multiple records: one poll-depth entry and one record entry per attempt', async () => {
    const records = [
      buildRecord({ recordId: 'rec-1', userId: 'u-1' }),
      buildRecord({ recordId: 'rec-2', userId: 'u-2' }),
      buildRecord({ recordId: 'rec-3', userId: 'u-3' }),
    ];
    const { worker, emailDeliveryPort, emailRecordRepository } = setup(records, 7);
    emailDeliveryPort.sendTransactional
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'temporary' })
      .mockRejectedValueOnce(new Error('boom'));

    await worker.processQueuedRecords();

    expect(emailRecordRepository.countByStatus).toHaveBeenCalledTimes(1);
    const depth = entriesFor('outbox.poll.depth');
    expect(depth).toHaveLength(1);
    expect(depth[0].queued_count).toBe(7);

    const processed = entriesFor('outbox.record.processed');
    expect(processed.map((e) => e.record_id)).toEqual(['rec-1', 'rec-2', 'rec-3']);
    expect(processed.map((e) => e.outcome)).toEqual(['sent', 'retry_scheduled', 'retry_scheduled']);
  });

  test('empty queue still emits exactly one poll-depth entry and no record entries', async () => {
    const { worker } = setup([], 0);

    await worker.processQueuedRecords();

    expect(entriesFor('outbox.poll.depth')).toEqual([
      expect.objectContaining({ event: 'outbox.poll.depth', queued_count: 0 }),
    ]);
    expect(entriesFor('outbox.record.processed')).toHaveLength(0);
  });

  test('every stdout line is single-line JSON with no recipient data', async () => {
    const records = [
      buildRecord({ recordId: 'rec-a', userId: 'u-a', retryCount: 0 }),
      buildRecord({ recordId: 'rec-b', userId: 'u-b', retryCount: 1 }),
    ];
    const { worker, emailDeliveryPort } = setup(records);
    emailDeliveryPort.sendTransactional
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'bounced' });

    await worker.processQueuedRecords();

    const lines = stdoutLines();
    expect(lines).toHaveLength(3);
    const forbiddenKeys = [
      'recipient', 'recipientAddress', 'recipient_address', 'email', 'address',
      'subject', 'message', 'body', 'name', 'username', 'templateVars', 'activationLink',
    ];
    for (const line of lines) {
      expect(line).not.toContain('\n');
      const parsed = JSON.parse(line) as Record<string, unknown>;
      for (const key of forbiddenKeys) {
        expect(parsed).not.toHaveProperty(key);
      }
      expect(line).not.toContain(RECIPIENT);
      expect(line).not.toContain(USERNAME);
      expect(line).not.toContain(SUBJECT);
      expect(line).not.toContain('tok-value');
    }
  });

  test('uses process.hrtime.bigint() as the monotonic clock for duration_ms', async () => {
    const record = buildRecord();
    const { worker } = setup([record]);
    const hrtime = jest
      .spyOn(process.hrtime, 'bigint')
      .mockReturnValueOnce(1_000_000_000n)
      .mockReturnValueOnce(1_215_400_000n);

    try {
      await worker.processQueuedRecords();
    } finally {
      hrtime.mockRestore();
    }

    expect(entriesFor('outbox.record.processed')[0].duration_ms).toBe(215);
  });

  test('duration_ms is clamped to 0 if the clock reading goes backwards', async () => {
    const record = buildRecord();
    const { worker } = setup([record]);
    const hrtime = jest
      .spyOn(process.hrtime, 'bigint')
      .mockReturnValueOnce(5_000_000n)
      .mockReturnValueOnce(1_000_000n);

    try {
      await worker.processQueuedRecords();
    } finally {
      hrtime.mockRestore();
    }

    expect(entriesFor('outbox.record.processed')[0].duration_ms).toBe(0);
  });

  test('OUTBOX_LOGGING_ENABLED=false silences the structured entries', async () => {
    process.env.OUTBOX_LOGGING_ENABLED = 'false';
    try {
      let IsolatedWorker!: typeof OutboxWorker;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        IsolatedWorker = require('./outbox.worker').OutboxWorker;
      });
      const deps = setup([buildRecord()]);
      const worker = new IsolatedWorker(
        deps.emailRecordRepository,
        deps.tokenRepository,
        deps.userRepository,
        deps.emailDeliveryPort,
      );

      await worker.processQueuedRecords();

      expect(deps.emailRecordRepository.updateStatus).toHaveBeenCalledWith('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'sent');
      expect(jsonEntries()).toHaveLength(0);
    } finally {
      delete process.env.OUTBOX_LOGGING_ENABLED;
    }
  });
});
