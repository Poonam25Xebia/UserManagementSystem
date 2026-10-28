import { v4 as uuidv4 } from 'uuid';
import { EmailRecordRepository } from './email-record.repository';
import { createTestDb, closeTestDb, TestDb } from '../integration/test-db';

describe('EmailRecordRepository.countByStatus', () => {
  let testDb: TestDb;
  let repository: EmailRecordRepository;

  function insertUser(): string {
    const id = uuidv4();
    testDb.db
      .prepare(
        `INSERT INTO users (id, username, username_normalised, email, password_hash, status, registration_timestamp)
         VALUES (?, ?, ?, ?, 'hash', 'pending', ?)`,
      )
      .run(id, `user-${id}`, `user-${id}`, `${id}@example.test`, new Date().toISOString());
    return id;
  }

  async function insertRecord(status: 'queued' | 'sent' | 'failed'): Promise<void> {
    await repository.insert({
      userId: insertUser(),
      recipientAddress: 'someone@example.test',
      dispatchTimestamp: new Date(),
      deliveryStatus: status,
      retryCount: 0,
      activationTokenId: null as unknown as string,
    });
  }

  beforeEach(() => {
    testDb = createTestDb();
    repository = new EmailRecordRepository(testDb.db);
  });

  afterEach(() => {
    closeTestDb(testDb);
  });

  test('returns 0 for every status on an empty table', async () => {
    await expect(repository.countByStatus('queued')).resolves.toBe(0);
    await expect(repository.countByStatus('sent')).resolves.toBe(0);
    await expect(repository.countByStatus('failed')).resolves.toBe(0);
  });

  test('counts only records with the requested delivery_status', async () => {
    await insertRecord('queued');
    await insertRecord('queued');
    await insertRecord('queued');
    await insertRecord('sent');
    await insertRecord('failed');
    await insertRecord('failed');

    await expect(repository.countByStatus('queued')).resolves.toBe(3);
    await expect(repository.countByStatus('sent')).resolves.toBe(1);
    await expect(repository.countByStatus('failed')).resolves.toBe(2);
  });

  test('reflects status transitions', async () => {
    await insertRecord('queued');
    const [record] = await repository.findByStatus('queued');

    await repository.updateStatus(record.recordId, 'sent');

    await expect(repository.countByStatus('queued')).resolves.toBe(0);
    await expect(repository.countByStatus('sent')).resolves.toBe(1);
  });
});
