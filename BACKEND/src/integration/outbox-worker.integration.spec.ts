process.env.ACTIVATION_BASE_URL = 'https://app.example.test';
process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.FROM_EMAIL = 'noreply@example.test';
process.env.PASSWORD_RECOVERY_BASE_URL = 'https://app.example.test';
process.env.PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID = 'd-test-recovery-template';

/**
 * OutboxWorker multi-instance integration tests (UMS-OUTBOX-1).
 *
 * Each "instance" is an OutboxWorker with its own workerId and its own
 * better-sqlite3 connection to the same database file, wired to the real
 * repositories. Only the outbound email provider is faked, so ordering of
 * claims, retries and terminal writes is decided by the real SQL.
 */

import Database from 'better-sqlite3';
import { OutboxWorker, OutboxWorkerOptions } from '../workers/outbox.worker';
import { EmailRecordRepository } from '../repositories/email-record.repository';
import { TokenRepository } from '../repositories/token.repository';
import { UserRepository } from '../repositories/user.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DeliveryResult, EmailRecipient } from '../types/registration.types';
import { createTestDb, closeTestDb, TestDb } from './test-db';
import { seedEmailRecord, readRawRecord } from './outbox-fixtures';

jest.setTimeout(30_000);

interface SendCall {
  workerId: string;
  address: string;
  settle: (result: DeliveryResult) => void;
}

/**
 * Fake provider. `mode` decides how each send settles: 'success' / 'failure'
 * settle after a short random delay (so instances interleave); 'manual'
 * leaves the send pending until the test calls settle().
 */
class FakeEmailDeliveryPort implements EmailDeliveryPort {
  public readonly calls: SendCall[] = [];

  constructor(
    private readonly workerId: string,
    public mode: 'success' | 'failure' | 'manual' = 'success',
  ) {}

  sendTransactional(
    recipient: EmailRecipient,
    _subject: string,
    _templateId: string,
    _templateVars: Record<string, string>,
  ): Promise<DeliveryResult> {
    return new Promise<DeliveryResult>((resolve) => {
      this.calls.push({ workerId: this.workerId, address: recipient.address, settle: resolve });
      if (this.mode === 'manual') return;
      const result: DeliveryResult =
        this.mode === 'success' ? { success: true } : { success: false, error: 'transient provider error' };
      setTimeout(() => resolve(result), Math.floor(Math.random() * 4) + 1);
    });
  }
}

interface Instance {
  worker: OutboxWorker;
  port: FakeEmailDeliveryPort;
  connection: Database.Database;
}

async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 1000 && !predicate(); i++) {
    await new Promise((r) => setImmediate(r));
  }
  if (!predicate()) throw new Error('condition not reached');
}

describe('OutboxWorker — multi-instance safety (UMS-OUTBOX-1)', () => {
  let testDb: TestDb;
  let clock: Date;
  const instances: Instance[] = [];

  function createInstance(
    workerId: string,
    mode: FakeEmailDeliveryPort['mode'] = 'success',
    options: Partial<OutboxWorkerOptions> = {},
  ): Instance {
    const connection = new Database(testDb.filePath, { timeout: 20_000 });
    const port = new FakeEmailDeliveryPort(workerId, mode);
    const worker = new OutboxWorker(
      new EmailRecordRepository(connection),
      new TokenRepository(connection),
      new UserRepository(connection),
      port,
      { workerId, claimLeaseMs: 60_000, maxRetries: 3, now: () => clock, ...options },
    );
    const instance = { worker, port, connection };
    instances.push(instance);
    return instance;
  }

  beforeEach(() => {
    testDb = createTestDb();
    clock = new Date('2026-01-01T00:00:00.000Z');
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    while (instances.length > 0) instances.pop()!.connection.close();
    closeTestDb(testDb);
  });

  test('[UMS-OUTBOX-1-AC1] two instances polling the same backlog concurrently process disjoint sets of records', async () => {
    const seeded = Array.from({ length: 30 }, () => seedEmailRecord(testDb.db));
    const a = createInstance('worker-a');
    const b = createInstance('worker-b');

    const [statsA, statsB] = await Promise.all([a.worker.poll(), b.worker.poll()]);

    const sentByA = new Set(a.port.calls.map((c) => c.address));
    const sentByB = new Set(b.port.calls.map((c) => c.address));
    expect(a.port.calls).toHaveLength(sentByA.size);
    expect(b.port.calls).toHaveLength(sentByB.size);
    expect([...sentByA].filter((addr) => sentByB.has(addr))).toEqual([]);
    expect(new Set([...sentByA, ...sentByB])).toEqual(new Set(seeded.map((s) => s.recipientAddress)));
    expect(sentByA.size).toBeGreaterThan(0);
    expect(sentByB.size).toBeGreaterThan(0);

    expect(statsA.claimed + statsB.claimed).toBe(seeded.length);
    expect(statsA.sent + statsB.sent).toBe(seeded.length);
    for (const { recordId } of seeded) {
      expect(readRawRecord(testDb.db, recordId)).toMatchObject({ delivery_status: 'sent', claimed_by: null });
    }
  });

  test('[UMS-OUTBOX-1-AC2] a record whose lease expired is reclaimed and processed by another instance', async () => {
    const stranded = seedEmailRecord(testDb.db);
    const live = seedEmailRecord(testDb.db);
    const repo = new EmailRecordRepository(testDb.db);
    // A crashed instance claimed both; one lease is already over, one is not.
    await repo.claim(stranded.recordId, 'crashed-worker', new Date(clock.getTime() - 120_000), 60_000);
    await repo.claim(live.recordId, 'crashed-worker', new Date(clock.getTime() - 1_000), 60_000);

    const b = createInstance('worker-b');
    const stats = await b.worker.poll();

    expect(b.port.calls.map((c) => c.address)).toEqual([stranded.recipientAddress]);
    expect(stats).toMatchObject({ claimed: 1, sent: 1 });
    expect(readRawRecord(testDb.db, stranded.recordId).delivery_status).toBe('sent');
    expect(readRawRecord(testDb.db, live.recordId)).toMatchObject({
      delivery_status: 'queued',
      claimed_by: 'crashed-worker',
    });
  });

  test('[UMS-OUTBOX-1-AC3] a transient failure increments retry_count by exactly one and leaves the record eligible again', async () => {
    const { recordId } = seedEmailRecord(testDb.db);
    const a = createInstance('worker-a', 'failure');

    const stats = await a.worker.poll();

    expect(stats).toMatchObject({ claimed: 1, retried: 1, failed: 0 });
    expect(readRawRecord(testDb.db, recordId)).toMatchObject({
      delivery_status: 'queued',
      retry_count: 1,
      claimed_by: null,
      claim_expires_at: null,
    });

    // Eligible for another attempt — by any instance, without waiting for a lease.
    const b = createInstance('worker-b', 'success');
    await b.worker.poll();
    expect(b.port.calls).toHaveLength(1);
    expect(readRawRecord(testDb.db, recordId)).toMatchObject({ delivery_status: 'sent', retry_count: 1 });
  });

  test('[UMS-OUTBOX-1-AC4] concurrent failure handling for the same record cannot push retry_count above the maximum', async () => {
    const { recordId } = seedEmailRecord(testDb.db, { retryCount: 0 });
    const opts = { maxRetries: 1, claimLeaseMs: 1_000 };
    const a = createInstance('worker-a', 'manual', opts);
    const b = createInstance('worker-b', 'manual', opts);

    // A claims and stalls mid-send; its lease expires; B reclaims and also stalls.
    const pollA = a.worker.poll();
    await until(() => a.port.calls.length === 1);
    clock = new Date(clock.getTime() + 1_000);
    const pollB = b.worker.poll();
    await until(() => b.port.calls.length === 1);

    // Both sends now fail at the same time.
    a.port.calls[0].settle({ success: false, error: 'boom-a' });
    b.port.calls[0].settle({ success: false, error: 'boom-b' });
    const [statsA, statsB] = await Promise.all([pollA, pollB]);

    const row = readRawRecord(testDb.db, recordId);
    expect(row.retry_count).toBe(1);
    expect(row.delivery_status).toBe('failed');
    expect(statsA.retried + statsB.retried).toBe(1);
    expect(statsA.failed + statsB.failed).toBe(1);
  });

  test('[UMS-OUTBOX-1-AC5] a record that reaches the maximum is marked failed and never attempted again', async () => {
    const { recordId } = seedEmailRecord(testDb.db);
    const a = createInstance('worker-a', 'failure', { maxRetries: 2 });

    expect(await a.worker.poll()).toMatchObject({ retried: 1 });
    expect(await a.worker.poll()).toMatchObject({ retried: 1 });
    expect(readRawRecord(testDb.db, recordId)).toMatchObject({ retry_count: 2, delivery_status: 'queued' });

    // At the maximum: the guarded increment is refused → failed.
    expect(await a.worker.poll()).toMatchObject({ retried: 0, failed: 1 });
    expect(readRawRecord(testDb.db, recordId)).toMatchObject({ retry_count: 2, delivery_status: 'failed' });
    expect(console.error).toHaveBeenCalledWith(
      '[OutboxWorker] Email delivery permanently failed',
      expect.objectContaining({ recordId }),
    );

    // Never attempted again, by this or any other instance.
    const b = createInstance('worker-b', 'failure', { maxRetries: 2 });
    expect(await a.worker.poll()).toMatchObject({ candidates: 0, claimed: 0 });
    expect(await b.worker.poll()).toMatchObject({ candidates: 0, claimed: 0 });
    expect(a.port.calls).toHaveLength(3);
    expect(b.port.calls).toHaveLength(0);
    expect(readRawRecord(testDb.db, recordId)).toMatchObject({ retry_count: 2, delivery_status: 'failed' });
  });

  test('[UMS-OUTBOX-1-AC6] a late-completing send cannot transition an already-terminal record again', async () => {
    const { recordId } = seedEmailRecord(testDb.db);
    const a = createInstance('worker-a', 'manual', { claimLeaseMs: 1_000 });
    const b = createInstance('worker-b', 'success', { claimLeaseMs: 1_000 });

    const pollA = a.worker.poll();
    await until(() => a.port.calls.length === 1);
    clock = new Date(clock.getTime() + 5_000); // A's lease has lapsed
    const statsB = await b.worker.poll();
    expect(statsB).toMatchObject({ claimed: 1, sent: 1 });
    expect(readRawRecord(testDb.db, recordId).delivery_status).toBe('sent');

    a.port.calls[0].settle({ success: true }); // A's send finally completes
    const statsA = await pollA;

    expect(statsA).toMatchObject({ sent: 0, alreadyTerminal: 1 });
    expect(readRawRecord(testDb.db, recordId)).toMatchObject({ delivery_status: 'sent', retry_count: 0 });

    const successLogs = (console.info as jest.Mock).mock.calls.filter(
      ([, entry]) => entry?.event === 'outbox.record.processed' && entry.recordId === recordId && entry.outcome === 'sent',
    );
    expect(successLogs).toHaveLength(1);
    expect(successLogs[0][1].workerId).toBe('worker-b');

    // And a sent record is never claimed or sent again.
    await a.worker.poll();
    expect(a.port.calls).toHaveLength(1);
  });

  test('[UMS-OUTBOX-1-AC7] each processed record emits a structured log entry with queue depth, outcome, retry count and duration', async () => {
    const ok = seedEmailRecord(testDb.db);
    seedEmailRecord(testDb.db, { deliveryStatus: 'sent' });
    const a = createInstance('worker-a', 'success');

    await a.worker.poll();

    const infoCalls = (console.info as jest.Mock).mock.calls;
    const perRecord = infoCalls.filter(([, entry]) => entry?.event === 'outbox.record.processed');
    expect(perRecord).toHaveLength(1);
    expect(perRecord[0][1]).toEqual({
      event: 'outbox.record.processed',
      workerId: 'worker-a',
      recordId: ok.recordId,
      queueDepth: 1,
      outcome: 'sent',
      retryCount: 0,
      durationMs: expect.any(Number),
    });
    expect(perRecord[0][1].durationMs).toBeGreaterThanOrEqual(0);

    const summary = infoCalls.filter(([, entry]) => entry?.event === 'outbox.poll.completed');
    expect(summary).toHaveLength(1);
    expect(summary[0][1]).toEqual(
      expect.objectContaining({
        workerId: 'worker-a',
        queueDepth: 1,
        claimed: 1,
        sent: 1,
        failed: 0,
        retried: 0,
        durationMs: expect.any(Number),
      }),
    );
  });

  test('[UMS-OUTBOX-1-AC7] retried records log the post-increment retry count', async () => {
    seedEmailRecord(testDb.db, { retryCount: 1 });
    const a = createInstance('worker-a', 'failure');

    await a.worker.poll();

    const perRecord = (console.info as jest.Mock).mock.calls.find(
      ([, entry]) => entry?.event === 'outbox.record.processed',
    );
    expect(perRecord?.[1]).toMatchObject({ outcome: 'retried', retryCount: 2, queueDepth: 1 });
  });
});
