const BASE_ENV: Record<string, string> = {
  ACTIVATION_BASE_URL: 'https://app.example.test',
  ADMIN_BEARER_TOKEN: 'test-admin-token',
  SENDGRID_API_KEY: 'SG.test-key',
  SENDGRID_TEMPLATE_ID: 'd-test-template',
  FROM_EMAIL: 'noreply@example.test',
  PASSWORD_RECOVERY_BASE_URL: 'https://app.example.test',
  PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID: 'd-test-recovery-template',
};

type OutboxLoggerModule = typeof import('./outbox-logger');

function loadLogger(loggingEnabled: string | undefined): OutboxLoggerModule {
  Object.assign(process.env, BASE_ENV);
  if (loggingEnabled === undefined) {
    delete process.env.OUTBOX_LOGGING_ENABLED;
  } else {
    process.env.OUTBOX_LOGGING_ENABLED = loggingEnabled;
  }
  let mod: OutboxLoggerModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./outbox-logger') as OutboxLoggerModule;
  });
  return mod as OutboxLoggerModule;
}

describe('outbox-logger', () => {
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    delete process.env.OUTBOX_LOGGING_ENABLED;
  });

  test('emitPollDepth writes a single JSON string argument with fixed event name', () => {
    const logger = loadLogger(undefined);
    logger.emitPollDepth(42, { pollIntervalMs: 30000 });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]).toHaveLength(1);
    const line = infoSpy.mock.calls[0][0] as string;
    expect(line).not.toContain('\n');
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      event: 'outbox.poll.depth',
      queued_count: 42,
      poll_interval_ms: 30000,
      worker_id: `pid:${process.pid}`,
    });
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  test('emitRecordProcessed emits only whitelisted fields and clamps negative durations', () => {
    const logger = loadLogger('true');
    const entryWithExtras = {
      record_id: 'rec-1',
      outcome: 'failed' as const,
      retry_count: 2,
      duration_ms: -5,
      recipientAddress: 'leak@example.test',
    };
    logger.emitRecordProcessed(entryWithExtras);

    const parsed = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(Object.keys(parsed).sort()).toEqual(
      ['duration_ms', 'event', 'outcome', 'record_id', 'retry_count', 'timestamp', 'worker_id'],
    );
    expect(parsed).toMatchObject({
      event: 'outbox.record.processed',
      record_id: 'rec-1',
      outcome: 'failed',
      retry_count: 2,
      duration_ms: 0,
    });
  });

  test('OUTBOX_LOGGING_ENABLED=false suppresses all entries', () => {
    const logger = loadLogger('false');
    logger.emitPollDepth(1);
    logger.emitRecordProcessed({ record_id: 'r', outcome: 'sent', retry_count: 0, duration_ms: 1 });

    expect(infoSpy).not.toHaveBeenCalled();
  });
});
