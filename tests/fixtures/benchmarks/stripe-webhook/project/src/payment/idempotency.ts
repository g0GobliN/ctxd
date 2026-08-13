import { Database } from "../platform/database.js";

/**
 * Idempotency key store.
 *
 * Stripe may deliver the same event more than once, so every webhook is
 * processed under a reservation. The unique index on `key` is what actually
 * enforces correctness — application-level checks alone race.
 */
export interface IdempotencyRecord {
  key: string;
  operation: string;
  status: "reserved" | "completed";
  resultId: string | null;
  createdAt: Date;
}

export interface Reservation {
  acquired: boolean;
}

export class IdempotencyStore {
  constructor(private readonly db: Database) {}

  async find(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRecord>(
      "SELECT key, operation, status, result_id AS resultId, created_at AS createdAt " +
        "FROM idempotency_keys WHERE key = $1 AND status = 'completed'",
      [key],
    );
    return row ?? null;
  }

  /**
   * Reserve a key. Returns `acquired: false` when another delivery of the
   * same event already holds it, which the caller answers with 409.
   */
  async reserve(key: string, operation: string): Promise<Reservation> {
    const inserted = await this.db.execute(
      "INSERT INTO idempotency_keys (key, operation, status, created_at) " +
        "VALUES ($1, $2, 'reserved', now()) ON CONFLICT (key) DO NOTHING",
      [key, operation],
    );
    return { acquired: inserted.rowCount === 1 };
  }

  async complete(key: string, resultId: string): Promise<void> {
    await this.db.execute(
      "UPDATE idempotency_keys SET status = 'completed', result_id = $2 WHERE key = $1",
      [key, resultId],
    );
  }

  /** Release a reservation so a later retry can make progress. */
  async release(key: string): Promise<void> {
    await this.db.execute(
      "DELETE FROM idempotency_keys WHERE key = $1 AND status = 'reserved'",
      [key],
    );
  }

  /** Reservations older than the retry window are abandoned work. */
  async expireStale(olderThanMinutes: number): Promise<number> {
    const result = await this.db.execute(
      "DELETE FROM idempotency_keys WHERE status = 'reserved' " +
        "AND created_at < now() - ($1 || ' minutes')::interval",
      [olderThanMinutes],
    );
    return result.rowCount;
  }
}
