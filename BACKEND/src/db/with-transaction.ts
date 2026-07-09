/**
 * with-transaction.ts
 *
 * Wraps better-sqlite3's synchronous transaction API so services can replace
 * their old `pool.connect() / BEGIN / COMMIT / ROLLBACK / release()` pattern
 * with a single call. `fn` must be synchronous — better-sqlite3 transactions
 * cannot span an `await`. On throw, better-sqlite3 automatically rolls back
 * and rethrows, so callers only need a `try/catch` around this call.
 */

import type { Database } from 'better-sqlite3';

export async function withTransaction<T>(db: Database, fn: () => T): Promise<T> {
  return db.transaction(fn)();
}
