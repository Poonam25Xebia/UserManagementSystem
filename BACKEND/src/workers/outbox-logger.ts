/**
 * outbox-logger.ts
 *
 * Shared single-line JSON log emitters for the OutboxWorker.
 *
 * Every entry is written as console.info(JSON.stringify(entry)) so it is one
 * line and parseable with JSON.parse. Entries are built from an explicit
 * whitelist of primitive fields — never from a spread record entity — so
 * recipient address, subject and template data cannot leak into the logs.
 */

import { appConfig } from '../config/app.config';

export const OUTBOX_POLL_DEPTH_EVENT = 'outbox.poll.depth';
export const OUTBOX_RECORD_PROCESSED_EVENT = 'outbox.record.processed';

export type OutboxRecordOutcome = 'sent' | 'retry_scheduled' | 'failed';

export interface OutboxLogEntry {
  record_id: string;
  outcome: OutboxRecordOutcome;
  retry_count: number;
  duration_ms: number;
}

export interface PollDepthOptions {
  pollIntervalMs?: number;
}

type LogValue = string | number;

function workerId(): string {
  return `pid:${process.pid}`;
}

function toNonNegativeInt(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function emit(entry: Record<string, LogValue>): void {
  if (!appConfig.outboxLoggingEnabled) {
    return;
  }
  console.info(JSON.stringify(entry));
}

export function emitPollDepth(count: number, options: PollDepthOptions = {}): void {
  const entry: Record<string, LogValue> = {
    event: OUTBOX_POLL_DEPTH_EVENT,
    queued_count: toNonNegativeInt(count),
    timestamp: new Date().toISOString(),
    worker_id: workerId(),
  };
  if (options.pollIntervalMs !== undefined) {
    entry.poll_interval_ms = toNonNegativeInt(options.pollIntervalMs);
  }
  emit(entry);
}

export function emitRecordProcessed(entry: OutboxLogEntry): void {
  emit({
    event: OUTBOX_RECORD_PROCESSED_EVENT,
    record_id: String(entry.record_id),
    outcome: entry.outcome,
    retry_count: toNonNegativeInt(entry.retry_count),
    duration_ms: toNonNegativeInt(entry.duration_ms),
    timestamp: new Date().toISOString(),
    worker_id: workerId(),
  });
}
