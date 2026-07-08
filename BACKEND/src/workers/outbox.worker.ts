/**
 * outbox.worker.ts
 *
 * Background worker that polls the `registration_email_records` table for
 * queued records and dispatches activation emails via EmailDeliveryPort.
 *
 * Design:
 *  - Polling interval and max retries come from appConfig.
 *  - On success: delivery_status → 'sent'.
 *  - On failure:
 *      retryCount < maxRetries → increment retry_count (stay 'queued')
 *      retryCount >= maxRetries → delivery_status → 'failed' + structured log
 *  - stop() clears the interval for clean shutdown.
 *
 * Requirements: US-073 FR-002, FR-008–009, FR-012
 */

import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { IEmailRecordRepository } from '../repositories/email-record.repository';
import { ITokenRepository } from '../repositories/token.repository';
import { IUserRepository } from '../repositories/user.repository';
import { appConfig } from '../config/app.config';

export interface IOutboxWorker {
  start(intervalMs?: number): void;
  stop(): void;
  processQueuedRecords(): Promise<void>;
}

export class OutboxWorker implements IOutboxWorker {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly emailRecordRepository: IEmailRecordRepository,
    private readonly tokenRepository: ITokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailDeliveryPort: EmailDeliveryPort,
  ) {}

  /**
   * Start polling for queued outbox records.
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
   * Process all currently queued outbox records.
   * Called on each polling tick and can also be called directly in tests.
   */
  async processQueuedRecords(): Promise<void> {
    const records = await this.emailRecordRepository.findByStatus('queued');

    for (const record of records) {
      try {
        // Resolve token value and user display name
        const token = await this.tokenRepository.findByUserId(record.userId);
        const user = await this.userRepository.findById(record.userId);

        if (token === null || user === null) {
          console.error('[OutboxWorker] Cannot dispatch: token or user not found', {
            userId: record.userId,
            recordId: record.recordId,
          });
          await this.emailRecordRepository.updateStatus(record.recordId, 'failed');
          continue;
        }

        // Build activation link
        const activationLink = `${appConfig.activationBaseUrl}/activate?token=${token.tokenValue}`;

        // Dispatch email via port
        const result = await this.emailDeliveryPort.sendTransactional(
          { address: record.recipientAddress, name: user.username },
          'Activate your account',
          appConfig.sendgridTemplateId,
          { activationLink, displayName: user.username },
        );

        if (result.success) {
          await this.emailRecordRepository.updateStatus(record.recordId, 'sent');
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
      await this.emailRecordRepository.incrementRetryCount(recordId);
    } else {
      await this.emailRecordRepository.updateStatus(recordId, 'failed');
      // Structured failure log — FR-012
      console.error('[OutboxWorker] Email delivery permanently failed', {
        recordId,
        userId,
        error: error ?? 'unknown',
      });
    }
  }
}
