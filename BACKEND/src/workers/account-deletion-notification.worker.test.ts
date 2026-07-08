process.env.ACTIVATION_BASE_URL = 'https://app.example.test';
process.env.ADMIN_BEARER_TOKEN = 'test-admin-token';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_TEMPLATE_ID = 'd-test-template';
process.env.PASSWORD_RECOVERY_BASE_URL = 'https://app.example.test';
process.env.PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID = 'd-test-recovery-template';
process.env.OTP_HASH_SECRET = 'test-otp-secret';
process.env.OTP_EMAIL_TEMPLATE_ID = 'd-test-otp-template';
process.env.ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID = 'd-test-deletion-request-template';
process.env.ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID = 'd-test-deletion-notice-template';

import { AccountDeletionNotificationWorker } from './account-deletion-notification.worker';
import { IDeletionNotificationRecordRepository } from '../repositories/deletion-notification-record.repository';
import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { DeletionNotificationRecord } from '../types/account-deletion.types';
import { appConfig } from '../config/app.config';

function buildRecord(overrides: Partial<DeletionNotificationRecord> = {}): DeletionNotificationRecord {
  return {
    recordId: 'record-1',
    userId: 'user-1',
    recipientAddress: 'jdoe@example.test',
    deletionDate: new Date('2026-01-01T00:00:00.000Z'),
    dispatchTimestamp: new Date('2026-01-01T00:00:00.000Z'),
    deliveryStatus: 'queued',
    retryCount: 0,
    ...overrides,
  };
}

describe('AccountDeletionNotificationWorker', () => {
  let notificationRecordRepository: jest.Mocked<IDeletionNotificationRecordRepository>;
  let emailDeliveryPort: jest.Mocked<EmailDeliveryPort>;
  let worker: AccountDeletionNotificationWorker;

  beforeEach(() => {
    notificationRecordRepository = {
      insert: jest.fn(),
      findByStatus: jest.fn(),
      updateStatus: jest.fn(),
      incrementRetryCount: jest.fn(),
    };
    emailDeliveryPort = {
      sendTransactional: jest.fn(),
    };
    worker = new AccountDeletionNotificationWorker(notificationRecordRepository, emailDeliveryPort);
  });

  describe('processQueuedRecords', () => {
    test('a successful send transitions the record to sent', async () => {
      const record = buildRecord();
      notificationRecordRepository.findByStatus.mockResolvedValue([record]);
      emailDeliveryPort.sendTransactional.mockResolvedValue({ success: true });

      await worker.processQueuedRecords();

      expect(emailDeliveryPort.sendTransactional).toHaveBeenCalledWith(
        { address: record.recipientAddress, name: 'User' },
        expect.any(String),
        'd-test-deletion-notice-template',
        { deletionDate: record.deletionDate.toISOString() },
      );
      expect(notificationRecordRepository.updateStatus).toHaveBeenCalledWith('record-1', 'sent');
      expect(notificationRecordRepository.incrementRetryCount).not.toHaveBeenCalled();
    });

    test('a failure below the retry ceiling increments retryCount and stays queued', async () => {
      const record = buildRecord({ retryCount: 0 });
      notificationRecordRepository.findByStatus.mockResolvedValue([record]);
      emailDeliveryPort.sendTransactional.mockResolvedValue({ success: false, error: 'network error' });

      await worker.processQueuedRecords();

      expect(notificationRecordRepository.incrementRetryCount).toHaveBeenCalledWith('record-1');
      expect(notificationRecordRepository.updateStatus).not.toHaveBeenCalled();
    });

    test('a failure at the retry ceiling transitions to failed and logs', async () => {
      const record = buildRecord({ retryCount: appConfig.outboxMaxRetries });
      notificationRecordRepository.findByStatus.mockResolvedValue([record]);
      emailDeliveryPort.sendTransactional.mockResolvedValue({ success: false, error: 'network error' });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await worker.processQueuedRecords();

      expect(notificationRecordRepository.updateStatus).toHaveBeenCalledWith('record-1', 'failed');
      expect(notificationRecordRepository.incrementRetryCount).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('permanently failed'),
        expect.objectContaining({ recordId: 'record-1', error: 'network error' }),
      );
      consoleErrorSpy.mockRestore();
    });

    test('a thrown error during dispatch is treated the same as a failure result', async () => {
      const record = buildRecord({ retryCount: 0 });
      notificationRecordRepository.findByStatus.mockResolvedValue([record]);
      emailDeliveryPort.sendTransactional.mockRejectedValue(new Error('provider unreachable'));

      await worker.processQueuedRecords();

      expect(notificationRecordRepository.incrementRetryCount).toHaveBeenCalledWith('record-1');
    });

    test('processes multiple queued records independently', async () => {
      const recordA = buildRecord({ recordId: 'record-a' });
      const recordB = buildRecord({ recordId: 'record-b' });
      notificationRecordRepository.findByStatus.mockResolvedValue([recordA, recordB]);
      emailDeliveryPort.sendTransactional
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'oops' });

      await worker.processQueuedRecords();

      expect(notificationRecordRepository.updateStatus).toHaveBeenCalledWith('record-a', 'sent');
      expect(notificationRecordRepository.incrementRetryCount).toHaveBeenCalledWith('record-b');
    });

    test('does nothing when there are no queued records', async () => {
      notificationRecordRepository.findByStatus.mockResolvedValue([]);

      await worker.processQueuedRecords();

      expect(emailDeliveryPort.sendTransactional).not.toHaveBeenCalled();
    });
  });

  describe('start / stop', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('start() polls at the given interval', () => {
      notificationRecordRepository.findByStatus.mockResolvedValue([]);

      worker.start(1000);
      jest.advanceTimersByTime(3000);

      expect(notificationRecordRepository.findByStatus).toHaveBeenCalledTimes(3);
    });

    test('calling start() twice does not create a second interval', () => {
      notificationRecordRepository.findByStatus.mockResolvedValue([]);

      worker.start(1000);
      worker.start(1000);
      jest.advanceTimersByTime(1000);

      expect(notificationRecordRepository.findByStatus).toHaveBeenCalledTimes(1);
    });

    test('stop() clears the interval so no further polling occurs', () => {
      notificationRecordRepository.findByStatus.mockResolvedValue([]);

      worker.start(1000);
      worker.stop();
      jest.advanceTimersByTime(5000);

      expect(notificationRecordRepository.findByStatus).not.toHaveBeenCalled();
    });
  });
});
