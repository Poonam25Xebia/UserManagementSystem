/**
 * run-migrations.ts
 *
 * Opens the SQLite database at DATABASE_PATH and applies any migration file
 * under this directory that hasn't already been recorded in the
 * `schema_migrations` table. Safe to run repeatedly — already-applied files
 * are skipped.
 *
 * Usage:
 *   ts-node db/migrations/run-migrations.ts
 *
 * Env var:
 *   DATABASE_PATH (default: ./data/app.db)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

const MIGRATIONS_DIR = path.resolve(__dirname);

function openDb(): Database.Database {
  const databasePath = process.env.DATABASE_PATH ?? './data/app.db';
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

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

export function runMigrations(db: Database.Database): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );

  const alreadyApplied = new Set(
    db
      .prepare('SELECT filename FROM schema_migrations')
      .all()
      .map((row) => (row as { filename: string }).filename),
  );

  for (const file of MIGRATION_FILES) {
    if (alreadyApplied.has(file)) {
      console.log(`  - ${file} already applied, skipping.`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`  Applying ${file}...`);
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString(),
      );
    })();
    console.log(`  ✓ ${file} applied.`);
  }

  console.log('All migrations completed successfully.');
}

if (require.main === module) {
  const db = openDb();
  try {
    runMigrations(db);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}
