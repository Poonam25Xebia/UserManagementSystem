import { EmailRecordRepository } from './email-record.repository';
import { createTestDb, closeTestDb, TestDb } from '../integration/test-db';

describe('EmailRecordRepository.countByStatus', () => {
  let testDb: TestDb;
  let repo: EmailRecordRepository;

  beforeEach(() => {
    testDb = createTestDb();
    repo = new EmailRecordRepository(testDb.db);
  });

  afterEach(() => {
    closeTestDb(testDb);
  });

  async function seed(statuses: Array<'queued' | 'sent' | 'failed'>): Promise<void> {
    const insertUser = testDb.db.prepare(
      `INSERT INTO users (id, username, username_normalised, email, password_hash, registration_timestamp)
       VALUES (?, ?, ?, ?, 'hash', '2026-01-01T00:00:00.000Z')`,
    );
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
  }

  test('returns 0 for every status on an empty table', async () => {
    await expect(repo.countByStatus('queued')).resolves.toBe(0);
    await expect(repo.countByStatus('sent')).resolves.toBe(0);
    await expect(repo.countByStatus('failed')).resolves.toBe(0);
  });

  test('counts records per delivery status as a number', async () => {
    await seed(['queued', 'queued', 'sent', 'failed', 'queued', 'sent']);

    const queued = await repo.countByStatus('queued');
    expect(typeof queued).toBe('number');
    expect(queued).toBe(3);
    await expect(repo.countByStatus('sent')).resolves.toBe(2);
    await expect(repo.countByStatus('failed')).resolves.toBe(1);
  });

  test('reflects status transitions', async () => {
    await seed(['queued', 'queued']);
    const [first] = await repo.findByStatus('queued');

    await repo.updateStatus(first.recordId, 'sent');

    await expect(repo.countByStatus('queued')).resolves.toBe(1);
    await expect(repo.countByStatus('sent')).resolves.toBe(1);
  });
});
