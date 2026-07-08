/**
 * run-migrations.ts
 *
 * Connects to PostgreSQL using environment variables and runs all migration
 * files in lexicographic order from this directory.
 *
 * Usage:
 *   ts-node db/migrations/run-migrations.ts
 *
 * Required env vars:
 *   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname);

const MIGRATION_FILES = [
  '001_create_users.sql',
  '002_create_activation_tokens.sql',
  '003_create_registration_email_records.sql',
  '004_create_otp_requests.sql',
  '005_alter_users_for_login.sql',
  '006_create_sessions.sql',
  '007_create_password_recovery_requests.sql',
  '008_alter_users_for_deletion.sql',
  '009_create_account_deletion_requests.sql',
  '010_create_account_deletion_notification_records.sql',
  '011_convert_deletion_requests_to_otp.sql',
];

async function runMigrations(): Promise<void> {
  const client = new Client({
    host: process.env['PGHOST'] ?? 'localhost',
    port: Number(process.env['PGPORT'] ?? 5432),
    database: process.env['PGDATABASE'],
    user: process.env['PGUSER'],
    password: process.env['PGPASSWORD'],
  });

  await client.connect();
  console.log('Connected to PostgreSQL. Running migrations...');

  try {
    for (const file of MIGRATION_FILES) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`  Applying ${file}...`);
      await client.query(sql);
      console.log(`  ✓ ${file} applied.`);
    }

    console.log('All migrations completed successfully.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
