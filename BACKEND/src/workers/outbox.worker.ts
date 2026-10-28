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
 *  - Each poll emits single-line JSON logs via outbox-logger.ts: one
 *    `outbox.poll.depth` per poll and one `outbox.record.processed` per attempt.
 *  - stop() clears the interval for clean shutdown.
 *
 * Requirements: US-073 FR-002, FR-008–009, FR-012
 */

import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { IEmailRecordRepository } from '../repositories/email-record.repository';
import { ITokenRepository } from '../repositories/token.repository';
import { IUserRepository } from '../repositories/user.repository';
import { appConfig } from '../config/app.config';
import * as outboxLogger from './outbox-logger';
import { OutboxRecordOutcome } from './outbox-logger';

interface FailureResult {
  outcome: OutboxRecordOutcome;
  retryCount: number;
}

export interface IOutboxWorker {
  start(intervalMs?: number): void;
  stop(): void;
  processQueuedRecords(): Promise<void>;
}

export class OutboxWorker implements IOutboxWorker {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private pollIntervalMs: number = appConfig.outboxPollIntervalMs;

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
    this.pollIntervalMs = intervalMs;
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
    const queuedCount = await this.emailRecordRepository.countByStatus('queued');
    outboxLogger.emitPollDepth(queuedCount, { pollIntervalMs: this.pollIntervalMs });

    const records = await this.emailRecordRepository.findByStatus('queued');

    for (const record of records) {
      let outcome: OutboxRecordOutcome | undefined;
      let retryCount = record.retryCount;
      const startedAt = process.hrtime.bigint();
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
          outcome = 'failed';
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
          outcome = 'sent';
        } else {
          ({ outcome, retryCount } = await this._handleFailure(
            record.recordId,
            record.retryCount,
            record.userId,
            result.error,
          ));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ({ outcome, retryCount } = await this._handleFailure(
          record.recordId,
          record.retryCount,
          record.userId,
          msg,
        ));
      } finally {
        const elapsedNs = process.hrtime.bigint() - startedAt;
        const durationMs = elapsedNs > 0n ? Number(elapsedNs / 1_000_000n) : 0;
        // outcome stays undefined only if persisting the failure itself threw;
        // that error propagates as before and no outcome can be claimed.
        if (outcome !== undefined) {
          outboxLogger.emitRecordProcessed({
            record_id: record.recordId,
            outcome,
            retry_count: retryCount,
            duration_ms: durationMs,
          });
        }
      }
    }
  }

  /**
   * Increment retry count or permanently mark a record as failed.
   * Returns the outcome and the retry_count now stored for the record.
   */
  private async _handleFailure(
    recordId: string,
    currentRetryCount: number,
    userId: string,
    error?: string,
  ): Promise<FailureResult> {
    if (currentRetryCount < appConfig.outboxMaxRetries) {
      await this.emailRecordRepository.incrementRetryCount(recordId);
      return { outcome: 'retry_scheduled', retryCount: currentRetryCount + 1 };
    }
    await this.emailRecordRepository.updateStatus(recordId, 'failed');
    // Structured failure log — FR-012
    console.error('[OutboxWorker] Email delivery permanently failed', {
      recordId,
      userId,
      error: error ?? 'unknown',
    });
    return { outcome: 'failed', retryCount: currentRetryCount };
  }
}
