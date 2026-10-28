/**
 * EmailRecordRepository — claim / lease / guarded-retry / terminal-write
 * tests (UMS-OUTBOX-1).
 *
 * Every test runs against a real SQLite database file built from the real
 * migrations. Concurrency tests open independent connections to the same
 * file — including connections in separate OS threads released through a
 * shared barrier — so the guarantees come from the SQL, not from mocks.
 */

import * as path from 'path';
import { Worker } from 'worker_threads';
import Database from 'better-sqlite3';
import { EmailRecordRepository } from './email-record.repository';
import { createTestDb, closeTestDb, TestDb } from '../integration/test-db';
import { seedEmailRecord, readRawRecord } from '../integration/outbox-fixtures';

jest.setTimeout(60_000);

const LEASE_MS = 60_000;

type ThreadOp =
  | { kind: 'claim'; workerId: string; leaseMs: number }
  | { kind: 'increment'; maxRetries: number };

const THREAD_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
require(workerData.tsNodePath).register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
const Database = require(workerData.sqlitePath);
const { EmailRecordRepository } = require(workerData.repoPath);
const db = new Database(workerData.dbPath, { timeout: 20000 });
const repo = new EmailRecordRepository(db);
const barrier = new Int32Array(workerData.barrier);
Atomics.add(barrier, 0, 1);
Atomics.wait(barrier, 1, 0);
(async () => {
  const results = [];
  for (const recordId of workerData.recordIds) {
    const op = workerData.op;
    const changes = op.kind === 'claim'
      ? await repo.claim(recordId, op.workerId, new Date(), op.leaseMs)
      : await repo.incrementRetryCountBelowMax(recordId, op.maxRetries);
    results.push({ recordId, changes });
  }
  db.close();
  parentPort.postMessage(results);
})().catch((err) => { throw err; });
`;

/**
 * Run `ops` in parallel OS threads, each with its own DB connection, all
 * released at the same instant. Returns each thread's per-record results.
 */
async function runInParallelThreads(
  dbPath: string,
  jobs: Array<{ op: ThreadOp; recordIds: string[] }>,
): Promise<Array<Array<{ recordId: string; changes: number }>>> {
  const barrier = new SharedArrayBuffer(8);
  const flags = new Int32Array(barrier);
  const common = {
    tsNodePath: require.resolve('ts-node'),
    sqlitePath: require.resolve('better-sqlite3'),
    repoPath: path.resolve(__dirname, 'email-record.repository.ts'),
    dbPath,
    barrier,
  };

  const done = jobs.map(
    (job) =>
      new Promise<Array<{ recordId: string; changes: number }>>((resolve, reject) => {
        const worker = new Worker(THREAD_SOURCE, {
          eval: true,
          workerData: { ...common, op: job.op, recordIds: job.recordIds },
        });
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.once('exit', (code) => {
          if (code !== 0) reject(new Error(`thread exited with code ${code}`));
        });
      }),
  );

  while (Atomics.load(flags, 0) < jobs.length) {
    await new Promise((r) => setTimeout(r, 10));
  }
  Atomics.store(flags, 1, 1);
  Atomics.notify(flags, 1);

  return Promise.all(done);
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

describe('EmailRecordRepository — multi-instance claim and retry (UMS-OUTBOX-1)', () => {
  let testDb: TestDb;
  let repo: EmailRecordRepository;
  let otherConnection: Database.Database;
  let otherRepo: EmailRecordRepository;

  beforeEach(() => {
    testDb = createTestDb();
    repo = new EmailRecordRepository(testDb.db);
    otherConnection = new Database(testDb.filePath, { timeout: 20_000 });
    otherRepo = new EmailRecordRepository(otherConnection);
  });

  afterEach(() => {
    otherConnection.close();
    closeTestDb(testDb);
  });

  describe('claim [UMS-OUTBOX-1-AC1]', () => {
    test('[UMS-OUTBOX-1-AC1] two concurrent claims on separate connections: exactly one wins, the other sees 0 affected rows', async () => {
      const { recordId } = seedEmailRecord(testDb.db);
      const now = new Date();

      const results = await Promise.all([
        repo.claim(recordId, 'worker-a', now, LEASE_MS),
        otherRepo.claim(recordId, 'worker-b', now, LEASE_MS),
      ]);

      expect([...results].sort()).toEqual([0, 1]);
      const row = readRawRecord(testDb.db, recordId);
      expect(row.claimed_by).toBe(results[0] === 1 ? 'worker-a' : 'worker-b');
      expect(row.claimed_at).toBe(now.toISOString());
      expect(row.claim_expires_at).toBe(new Date(now.getTime() + LEASE_MS).toISOString());
    });

    test('[UMS-OUTBOX-1-AC1] parallel OS threads racing for the same backlog claim every record exactly once', async () => {
      const recordIds = Array.from({ length: 40 }, () => seedEmailRecord(testDb.db).recordId);
      const workerIds = ['thread-1', 'thread-2', 'thread-3', 'thread-4'];

      const perThread = await runInParallelThreads(
        testDb.filePath,
        workerIds.map((workerId) => ({
          op: { kind: 'claim', workerId, leaseMs: LEASE_MS },
          recordIds: shuffled(recordIds),
        })),
      );

      const winners = new Map<string, string[]>();
      perThread.forEach((results, i) => {
        for (const { recordId, changes } of results) {
          expect([0, 1]).toContain(changes);
          if (changes === 1) {
            winners.set(recordId, [...(winners.get(recordId) ?? []), workerIds[i]]);
          }
        }
      });

      for (const recordId of recordIds) {
        const owners = winners.get(recordId) ?? [];
        expect(owners).toHaveLength(1);
        expect(readRawRecord(testDb.db, recordId).claimed_by).toBe(owners[0]);
      }
    });

    test('a record that is not queued cannot be claimed', async () => {
      const sent = seedEmailRecord(testDb.db, { deliveryStatus: 'sent' });
      const failed = seedEmailRecord(testDb.db, { deliveryStatus: 'failed' });

      expect(await repo.claim(sent.recordId, 'worker-a', new Date(), LEASE_MS)).toBe(0);
      expect(await repo.claim(failed.recordId, 'worker-a', new Date(), LEASE_MS)).toBe(0);
    });
  });

  describe('lease expiry [UMS-OUTBOX-1-AC2]', () => {
    test('[UMS-OUTBOX-1-AC2] a live lease is not reclaimable; an expired lease is', async () => {
      const { recordId } = seedEmailRecord(testDb.db);
      const t0 = new Date('2026-01-01T00:00:00.000Z');

      expect(await repo.claim(recordId, 'worker-a', t0, 1_000)).toBe(1);

      const stillLive = new Date(t0.getTime() + 999);
      expect(await otherRepo.claim(recordId, 'worker-b', stillLive, 1_000)).toBe(0);
      expect(await otherRepo.findClaimable(stillLive)).toHaveLength(0);

      const expired = new Date(t0.getTime() + 1_000);
      expect((await otherRepo.findClaimable(expired)).map((r) => r.recordId)).toEqual([recordId]);
      expect(await otherRepo.claim(recordId, 'worker-b', expired, 1_000)).toBe(1);
      expect(readRawRecord(testDb.db, recordId).claimed_by).toBe('worker-b');
    });

    test('releaseClaim only releases a claim the caller still holds', async () => {
      const { recordId } = seedEmailRecord(testDb.db);
      await repo.claim(recordId, 'worker-a', new Date(), LEASE_MS);

      expect(await repo.releaseClaim(recordId, 'worker-b')).toBe(0);
      expect(readRawRecord(testDb.db, recordId).claimed_by).toBe('worker-a');

      expect(await repo.releaseClaim(recordId, 'worker-a')).toBe(1);
      const row = readRawRecord(testDb.db, recordId);
      expect(row.claimed_by).toBeNull();
      expect(row.claim_expires_at).toBeNull();
      expect(await otherRepo.claim(recordId, 'worker-b', new Date(), LEASE_MS)).toBe(1);
    });
  });

  describe('guarded retry increment [UMS-OUTBOX-1-AC3] [UMS-OUTBOX-1-AC4]', () => {
    test('[UMS-OUTBOX-1-AC3] each increment adds exactly one and leaves the record queued', async () => {
      const { recordId } = seedEmailRecord(testDb.db, { retryCount: 0 });

      expect(await repo.incrementRetryCountBelowMax(recordId, 3)).toBe(1);
      expect(readRawRecord(testDb.db, recordId)).toMatchObject({ retry_count: 1, delivery_status: 'queued' });
      expect(await repo.incrementRetryCountBelowMax(recordId, 3)).toBe(1);
      expect(readRawRecord(testDb.db, recordId)).toMatchObject({ retry_count: 2, delivery_status: 'queued' });
    });

    test('[UMS-OUTBOX-1-AC4] the increment refuses to pass the configured maximum', async () => {
      const { recordId } = seedEmailRecord(testDb.db, { retryCount: 2 });

      expect(await repo.incrementRetryCountBelowMax(recordId, 3)).toBe(1);
      expect(await repo.incrementRetryCountBelowMax(recordId, 3)).toBe(0);
      expect(await repo.incrementRetryCountBelowMax(recordId, 3)).toBe(0);
      expect(readRawRecord(testDb.db, recordId).retry_count).toBe(3);
    });

    test('[UMS-OUTBOX-1-AC4] concurrent increments from parallel OS threads never exceed the maximum', async () => {
      const maxRetries = 3;
      const recordIds = Array.from({ length: 10 }, () => seedEmailRecord(testDb.db).recordId);

      const perThread = await runInParallelThreads(
        testDb.filePath,
        Array.from({ length: 4 }, () => ({
          // Each thread fails every record twice → 8 attempts per record.
          op: { kind: 'increment' as const, maxRetries },
          recordIds: shuffled([...recordIds, ...recordIds]),
        })),
      );

      const accepted = new Map<string, number>();
      for (const results of perThread) {
        for (const { recordId, changes } of results) {
          accepted.set(recordId, (accepted.get(recordId) ?? 0) + changes);
        }
      }
      for (const recordId of recordIds) {
        expect(accepted.get(recordId)).toBe(maxRetries);
        expect(readRawRecord(testDb.db, recordId).retry_count).toBe(maxRetries);
      }
    });

    test('[UMS-OUTBOX-1-AC5] a failed record is never incremented or re-queued', async () => {
      const { recordId } = seedEmailRecord(testDb.db, { retryCount: 1 });
      expect(await repo.markTerminal(recordId, 'failed')).toBe(1);

      expect(await repo.incrementRetryCountBelowMax(recordId, 5)).toBe(0);
      expect(await repo.markTerminal(recordId, 'failed')).toBe(0);
      expect(await repo.claim(recordId, 'worker-a', new Date(), LEASE_MS)).toBe(0);
      expect(await repo.findClaimable(new Date())).toHaveLength(0);
      expect(readRawRecord(testDb.db, recordId)).toMatchObject({ retry_count: 1, delivery_status: 'failed' });
    });
  });

  describe('terminal transitions [UMS-OUTBOX-1-AC6]', () => {
    test('[UMS-OUTBOX-1-AC6] a terminal record rejects a second success transition', async () => {
      const { recordId } = seedEmailRecord(testDb.db);
      await repo.claim(recordId, 'worker-a', new Date(), LEASE_MS);

      expect(await repo.markTerminal(recordId, 'sent')).toBe(1);
      const row = readRawRecord(testDb.db, recordId);
      expect(row.delivery_status).toBe('sent');
      expect(row.claimed_by).toBeNull();

      expect(await otherRepo.markTerminal(recordId, 'sent')).toBe(0);
      expect(await otherRepo.markTerminal(recordId, 'failed')).toBe(0);
      expect(readRawRecord(testDb.db, recordId).delivery_status).toBe('sent');
    });

    test('[UMS-OUTBOX-1-AC6] concurrent success writes for the same record: exactly one succeeds', async () => {
      const { recordId } = seedEmailRecord(testDb.db);

      const results = await Promise.all([
        repo.markTerminal(recordId, 'sent'),
        otherRepo.markTerminal(recordId, 'sent'),
      ]);
      expect([...results].sort()).toEqual([0, 1]);
    });
  });

  test('countByStatus returns queue depth', async () => {
    seedEmailRecord(testDb.db);
    seedEmailRecord(testDb.db);
    seedEmailRecord(testDb.db, { deliveryStatus: 'sent' });

    expect(await repo.countByStatus('queued')).toBe(2);
    expect(await repo.countByStatus('sent')).toBe(1);
  });

  test('the claim predicate is served by an index', () => {
    const plan = testDb.db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT * FROM registration_email_records
          WHERE delivery_status = 'queued' AND (claim_expires_at IS NULL OR claim_expires_at <= ?)`,
      )
      .all(new Date().toISOString()) as Array<{ detail: string }>;

    expect(plan.map((p) => p.detail).join(' ')).toMatch(/USING (COVERING )?INDEX idx_reg_email_status_claim_expiry/);
  });
});
