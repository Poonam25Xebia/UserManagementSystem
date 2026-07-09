/**
 * migrate.ts
 *
 * Applies any migration file under db/migrations/ that hasn't already been
 * recorded in the `schema_migrations` table. Called on every server startup
 * so no manual database setup is required. Mirrors db/migrations/run-migrations.ts
 * (the standalone `npm run db:migrate` CLI entry) — that file stays outside
 * `src/` and is self-contained so it isn't bound by this project's `rootDir`
 * restriction, so the migration-list/apply logic is intentionally duplicated
 * in both places; keep them in sync when adding a new migration file.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Database } from 'better-sqlite3';

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

export function runMigrations(db: Database): void {
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
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString(),
      );
    })();
  }
}
