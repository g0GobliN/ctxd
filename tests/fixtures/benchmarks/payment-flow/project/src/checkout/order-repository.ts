import { Database } from "../platform/database.js";
import type { CartLine } from "./cart.js";

/** Order persistence. */
export class OrderRepository {
  constructor(private readonly db: Database) {}

  async create(customerId: string, lines: CartLine[], totalCents: number, chargeId: string): Promise<string> {
    const rows = await this.db.query<{ id: string }>(
      "INSERT INTO orders (customer_id, total_cents, charge_id) VALUES ($1, $2, $3) RETURNING id",
      [customerId, totalCents, chargeId],
    );
    const id = rows[0]?.id ?? "";
    for (const line of lines) {
      await this.db.query(
        "INSERT INTO order_lines (order_id, sku, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)",
        [id, line.sku, line.quantity, line.unitPriceCents],
      );
    }
    return id;
  }
}
