/**
 * outbox.worker.ts
 *
 * Background worker that polls the `registration_email_records` table for
 * queued records and dispatches activation emails via EmailDeliveryPort.
 *
 * Design:
 *  - Polling interval and max retries come from appConfig.
 *  - Multi-instance safe (UMS-OUTBOX-1): a record is claimed with a
 *    conditional UPDATE (EmailRecordRepository.claim) before any send. An
 *    affected-row count of 0 means another instance owns it — skip. Claims
 *    carry a lease (appConfig.outboxClaimLeaseMs) so a crashed instance's
 *    records become claimable again.
 *  - On success: delivery_status → 'sent', guarded on status 'queued' so a
 *    late-completing send cannot record a second success.
 *  - On failure: retry_count is incremented in one statement guarded by
 *    retry_count < maxRetries (record stays 'queued' and its claim is
 *    released). If the increment is refused → delivery_status → 'failed'
 *    + structured log.
 *  - Every processed record and every poll emits a structured log entry.
 *  - stop() clears the interval for clean shutdown.
 *
 * Requirements: US-073 FR-002, FR-008–009, FR-012; UMS-OUTBOX-1 FR-001–005
 */

import { EmailDeliveryPort } from '../adapters/email-delivery.port';
import { IEmailRecordRepository } from '../repositories/email-record.repository';
import { ITokenRepository } from '../repositories/token.repository';
import { IUserRepository } from '../repositories/user.repository';
import { RegistrationEmailRecord } from '../types/registration.types';
import { appConfig } from '../config/app.config';

export interface IOutboxWorker {
  start(intervalMs?: number): void;
  stop(): void;
  processQueuedRecords(): Promise<void>;
}

export interface OutboxWorkerOptions {
  workerId: string;
  claimLeaseMs: number;
  maxRetries: number;
  now: () => Date;
}

/**
 * Outcome of processing one claimed record:
 *  - sent: delivered and marked sent
 *  - retried: failed, retry_count incremented, record re-queued
 *  - failed: marked terminally failed
 *  - already_terminal: the record became terminal elsewhere before this
 *    instance could write its result (e.g. late-completing send) — no write
 *  - error: an unexpected error; the claim is left to expire
 */
export type OutboxRecordOutcome = 'sent' | 'retried' | 'failed' | 'already_terminal' | 'error';

export interface OutboxPollStats {
  queueDepth: number;
  candidates: number;
  claimed: number;
  skipped: number;
  sent: number;
  failed: number;
  retried: number;
  alreadyTerminal: number;
  errors: number;
}

const LOG_PREFIX = '[OutboxWorker]';

export class OutboxWorker implements IOutboxWorker {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly options: OutboxWorkerOptions;

  constructor(
    private readonly emailRecordRepository: IEmailRecordRepository,
    private readonly tokenRepository: ITokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailDeliveryPort: EmailDeliveryPort,
    options: Partial<OutboxWorkerOptions> = {},
  ) {
    this.options = {
      workerId: appConfig.outboxWorkerId,
      claimLeaseMs: appConfig.outboxClaimLeaseMs,
      maxRetries: appConfig.outboxMaxRetries,
      now: () => new Date(),
      ...options,
    };
  }

  get workerId(): string {
    return this.options.workerId;
  }

  /**
   * Start polling for queued outbox records.
   * @param intervalMs - Polling interval in ms (defaults to appConfig value).
   */
  start(intervalMs: number = appConfig.outboxPollIntervalMs): void {
    if (this.intervalHandle !== null) {
      return; // already running
    }
    this.intervalHandle = setInterval(() => {
      void this.processQueuedRecords().catch((err: unknown) => {
        console.error(`${LOG_PREFIX} Poll failed`, {
          event: 'outbox.poll.error',
          workerId: this.options.workerId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
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
   * Claim and process every currently claimable outbox record.
   * Called on each polling tick and can also be called directly in tests.
   */
  async processQueuedRecords(): Promise<void> {
    await this.poll();
  }

  /** Same as processQueuedRecords() but returns the poll statistics. */
  async poll(): Promise<OutboxPollStats> {
    const pollStartedAt = Date.now();
    const queueDepth = await this.emailRecordRepository.countByStatus('queued');
    const candidates = await this.emailRecordRepository.findClaimable(this.options.now());

    const stats: OutboxPollStats = {
      queueDepth,
      candidates: candidates.length,
      claimed: 0,
      skipped: 0,
      sent: 0,
      failed: 0,
      retried: 0,
      alreadyTerminal: 0,
      errors: 0,
    };

    for (const candidate of candidates) {
      const won = await this.emailRecordRepository.claim(
        candidate.recordId,
        this.options.workerId,
        this.options.now(),
        this.options.claimLeaseMs,
      );
      if (won === 0) {
        stats.skipped++; // another instance owns it
        continue;
      }
      stats.claimed++;

      const startedAt = Date.now();
      let outcome: OutboxRecordOutcome;
      let retryCount = candidate.retryCount;
      try {
        // Re-read after claiming so retry_count reflects any concurrent update.
        const record = (await this.emailRecordRepository.findById(candidate.recordId)) ?? candidate;
        retryCount = record.retryCount;
        outcome = await this._processClaimed(record);
        if (outcome === 'retried') {
          retryCount++;
        }
      } catch (err: unknown) {
        outcome = 'error';
        console.error(`${LOG_PREFIX} Unexpected error processing record`, {
          event: 'outbox.record.error',
          workerId: this.options.workerId,
          recordId: candidate.recordId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      this._count(stats, outcome);
      console.info(`${LOG_PREFIX} Record processed`, {
        event: 'outbox.record.processed',
        workerId: this.options.workerId,
        recordId: candidate.recordId,
        queueDepth,
        outcome,
        retryCount,
        durationMs: Date.now() - startedAt,
      });
    }

    console.info(`${LOG_PREFIX} Poll completed`, {
      event: 'outbox.poll.completed',
      workerId: this.options.workerId,
      ...stats,
      durationMs: Date.now() - pollStartedAt,
    });

    return stats;
  }

  private _count(stats: OutboxPollStats, outcome: OutboxRecordOutcome): void {
    switch (outcome) {
      case 'sent':
        stats.sent++;
        break;
      case 'retried':
        stats.retried++;
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'already_terminal':
        stats.alreadyTerminal++;
        break;
      case 'error':
        stats.errors++;
        break;
    }
  }

  /** Process a record this instance has claimed. */
  private async _processClaimed(record: RegistrationEmailRecord): Promise<OutboxRecordOutcome> {
    let sendError: string | undefined;
    let sent = false;
    try {
      // Resolve token value and user display name
      const token = await this.tokenRepository.findByUserId(record.userId);
      const user = await this.userRepository.findById(record.userId);

      if (token === null || user === null) {
        console.error(`${LOG_PREFIX} Cannot dispatch: token or user not found`, {
          userId: record.userId,
          recordId: record.recordId,
        });
        const changed = await this.emailRecordRepository.markTerminal(record.recordId, 'failed');
        return changed === 1 ? 'failed' : 'already_terminal';
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
      sent = result.success;
      sendError = result.error;
    } catch (err: unknown) {
      sendError = err instanceof Error ? err.message : String(err);
    }

    if (sent) {
      const changed = await this.emailRecordRepository.markTerminal(record.recordId, 'sent');
      return changed === 1 ? 'sent' : 'already_terminal';
    }
    return this._handleFailure(record.recordId, record.userId, sendError);
  }

  /**
   * Atomically increment retry count (guarded by the configured maximum) or
   * permanently mark a record as failed when the increment is refused.
   */
  private async _handleFailure(
    recordId: string,
    userId: string,
    error?: string,
  ): Promise<OutboxRecordOutcome> {
    const incremented = await this.emailRecordRepository.incrementRetryCountBelowMax(
      recordId,
      this.options.maxRetries,
    );
    if (incremented === 1) {
      await this.emailRecordRepository.releaseClaim(recordId, this.options.workerId);
      return 'retried';
    }

    const changed = await this.emailRecordRepository.markTerminal(recordId, 'failed');
    if (changed === 0) {
      return 'already_terminal';
    }
    // Structured failure log — FR-012
    console.error(`${LOG_PREFIX} Email delivery permanently failed`, {
      recordId,
      userId,
      error: error ?? 'unknown',
    });
    return 'failed';
  }
}
