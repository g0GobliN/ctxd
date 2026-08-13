import { Database } from "../platform/database.js";

/**
 * Persistence for payments.
 *
 * A duplicate Stripe event must never produce a second Payment row — the
 * webhook handler guarantees this with the idempotency store, and the unique
 * index on `stripe_payment_intent_id` is the backstop.
 */
export class PaymentRepository {
  constructor(private readonly db: Database) {}

  async markSucceeded(paymentIntentId: string, amount: number): Promise<string> {
    const row = await this.db.queryOne<{ id: string }>(
      "INSERT INTO payments (stripe_payment_intent_id, amount, status) " +
        "VALUES ($1, $2, 'succeeded') " +
        "ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'succeeded' " +
        "RETURNING id",
      [paymentIntentId, amount],
    );
    return row.id;
  }

  async markFailed(paymentIntentId: string): Promise<string> {
    const row = await this.db.queryOne<{ id: string }>(
      "UPDATE payments SET status = 'failed' WHERE stripe_payment_intent_id = $1 RETURNING id",
      [paymentIntentId],
    );
    return row.id;
  }

  async markRefunded(chargeId: string): Promise<string> {
    const row = await this.db.queryOne<{ id: string }>(
      "UPDATE payments SET status = 'refunded' WHERE stripe_charge_id = $1 RETURNING id",
      [chargeId],
    );
    return row.id;
  }

  async findByIntent(paymentIntentId: string): Promise<{ id: string; status: string } | null> {
    return this.db.queryOne("SELECT id, status FROM payments WHERE stripe_payment_intent_id = $1", [
      paymentIntentId,
    ]);
  }
}
