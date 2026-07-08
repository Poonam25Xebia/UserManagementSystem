/**
 * account-deletion-notification.worker.ts
 *
 * Background worker that polls the `account_deletion_notification_records`
 * table for queued records and dispatches post-deletion notice emails via
 * EmailDeliveryPort. Structurally identical to OutboxWorker (F-01) — unlike
 * that worker, no join against a token/user table is needed here, since the
 * recipient address and deletion date are captured directly on the record at
 * confirmDeletion() time (before the owning user row is anonymized).
 *
 * Design:
 *  - Polling interval and max retries come from appConfig (shared with
 *    OutboxWorker — no new tunables, per design.md Performance Considerations).
 *  - On success: delivery_status -> 'sent'.
 *  - On failure:
 *      retryCount < maxRetries -> increment retry_count (stay 'queued')
 *      retryCount >= maxRetries -> delivery_status -> 'failed' + structured log
 *  - stop() clears the interval for clean shutdown.
 *
 * Requirements: US-033 FR-001–003, EC-002
 */

import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { IDeletionNotificationRecordRepository } from '../repositories/deletion-notification-record.repository';
import { accountDeletionConfig } from '../config/account-deletion.config';
import { appConfig } from '../config/app.config';

export interface IAccountDeletionNotificationWorker {
  start(intervalMs?: number): void;
  stop(): void;
  processQueuedRecords(): Promise<void>;
}

export class AccountDeletionNotificationWorker implements IAccountDeletionNotificationWorker {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly notificationRecordRepository: IDeletionNotificationRecordRepository,
    private readonly emailDeliveryPort: EmailDeliveryPort,
  ) {}

  /**
   * Start polling for queued notification records.
   * @param intervalMs - Polling interval in ms (defaults to appConfig value).
   */
  start(intervalMs: number = appConfig.outboxPollIntervalMs): void {
    if (this.intervalHandle !== null) {
      return; // already running
    }
    this.intervalHandle = setInterval(() => {
      void this.processQueuedRecords();
    }, intervalMs);
  }

  /**
   * Stop the polling interval — allows clean shutdown.
   */
  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Process all currently queued notification records.
   * Called on each polling tick and can also be called directly in tests.
   */
  async processQueuedRecords(): Promise<void> {
    const records = await this.notificationRecordRepository.findByStatus('queued');

    for (const record of records) {
      try {
        const result = await this.emailDeliveryPort.sendTransactional(
          { address: record.recipientAddress, name: 'User' },
          'Your account has been deleted',
          accountDeletionConfig.noticeEmailTemplateId,
          { deletionDate: record.deletionDate.toISOString() },
        );

        if (result.success) {
          await this.notificationRecordRepository.updateStatus(record.recordId, 'sent');
        } else {
          await this._handleFailure(record.recordId, record.retryCount, record.userId, result.error);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await this._handleFailure(record.recordId, record.retryCount, record.userId, msg);
      }
    }
  }

  /**
   * Increment retry count or permanently mark a record as failed.
   */
  private async _handleFailure(
    recordId: string,
    currentRetryCount: number,
    userId: string,
    error?: string,
  ): Promise<void> {
    if (currentRetryCount < appConfig.outboxMaxRetries) {
      await this.notificationRecordRepository.incrementRetryCount(recordId);
    } else {
      await this.notificationRecordRepository.updateStatus(recordId, 'failed');
      // Structured failure log — mirrors OutboxWorker's FR-012 pattern.
      console.error('[AccountDeletionNotificationWorker] Notification delivery permanently failed', {
        recordId,
        userId,
        error: error ?? 'unknown',
      });
    }
  }
}
