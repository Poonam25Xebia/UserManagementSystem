/**
 * connection.ts
 *
 * Opens the application's SQLite database, creating the containing folder
 * and the database file itself if either is missing — no manual database
 * setup is required.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export type { Database } from 'better-sqlite3';

export function createDb(databasePath: string = process.env.DATABASE_PATH ?? './data/app.db'): Database.Database {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}
