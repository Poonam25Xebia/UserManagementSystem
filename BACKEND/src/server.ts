import 'dotenv/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { createApp } from './app';
import { EmailRecordRepository } from './repositories/email-record.repository';
import { TokenRepository } from './repositories/token.repository';
import { UserRepository } from './repositories/user.repository';
import { DeletionNotificationRecordRepository } from './repositories/deletion-notification-record.repository';
import { SendGridEmailAdapter } from './adapters/sendgrid-email.adapter';
import { EmailOtpDeliveryAdapter } from './adapters/email-otp-delivery.adapter';
import { OutboxWorker } from './workers/outbox.worker';
import { AccountDeletionNotificationWorker } from './workers/account-deletion-notification.worker';
import { otpConfig } from './config/otp.config';

const pool = new Pool();
const otpRedisClient = new Redis(otpConfig.redisUrl);
const emailDeliveryPort = new SendGridEmailAdapter();
const otpDeliveryPort = new EmailOtpDeliveryAdapter(emailDeliveryPort);
const app = createApp(pool, otpRedisClient, otpDeliveryPort, emailDeliveryPort);

const emailRecordRepository = new EmailRecordRepository(pool);
const tokenRepository = new TokenRepository(pool);
const userRepository = new UserRepository(pool);
const outboxWorker = new OutboxWorker(
  emailRecordRepository,
  tokenRepository,
  userRepository,
  emailDeliveryPort,
);

const deletionNotificationRecordRepository = new DeletionNotificationRecordRepository(pool);
const accountDeletionNotificationWorker = new AccountDeletionNotificationWorker(
  deletionNotificationRecordRepository,
  emailDeliveryPort,
);

outboxWorker.start();
accountDeletionNotificationWorker.start();

const port = parseInt(process.env.PORT ?? '3000', 10);
const server = app.listen(port, () => {
  console.log(`User Management Service listening on port ${port}`);
});

function shutdown(): void {
  console.log('Shutting down gracefully...');
  outboxWorker.stop();
  accountDeletionNotificationWorker.stop();
  server.close(() => {
    Promise.all([pool.end(), otpRedisClient.quit()]).then(() => {
      console.log('Shutdown complete.');
      process.exit(0);
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
