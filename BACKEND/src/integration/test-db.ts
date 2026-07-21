/**
 * test-db.ts
 *
 * Test-only helper that gives each integration spec its own isolated SQLite
 * database file, built from the real migration SQL under db/migrations/ —
 * so tests exercise the same schema production uses, instead of a
 * hand-duplicated copy that can drift.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

const MIGRATION_FILES = [
  '001_create_users.sql',
  '002_create_activation_tokens.sql',
  '003_create_registration_email_records.sql',
  '004_create_otp_requests.sql',
  '005_create_sessions.sql',
  '006_create_password_recovery_requests.sql',
  '007_create_account_deletion_requests.sql',
  '008_create_account_deletion_notification_records.sql',
];

const TABLES_IN_FK_SAFE_ORDER = [
  'account_deletion_notification_records',
  'account_deletion_requests',
  'password_recovery_requests',
  'sessions',
  'otp_requests',
  'registration_email_records',
  'activation_tokens',
  'users',
];

export interface TestDb {
  db: Database.Database;
  filePath: string;
}

export function createTestDb(): TestDb {
  const filePath = path.join(os.tmpdir(), `ums-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');

  for (const file of MIGRATION_FILES) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.exec(sql);
  }

  return { db, filePath };
}

export function clearAllTables(db: Database.Database): void {
  for (const table of TABLES_IN_FK_SAFE_ORDER) {
    db.exec(`DELETE FROM ${table}`);
  }
}

export function closeTestDb({ db, filePath }: TestDb): void {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    const candidate = `${filePath}${suffix}`;
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
    }
  }
}
