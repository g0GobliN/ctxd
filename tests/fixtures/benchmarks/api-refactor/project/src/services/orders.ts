import { Database } from "../platform/database.js";

export interface OrderRow {
  id: string;
  createdAt: string;
}

export class OrderService {
  constructor(private readonly db: Database) {}

  async list(page: number): Promise<OrderRow[]> {
    return this.db.query<OrderRow>(
      "SELECT id, created_at AS createdAt FROM orders ORDER BY created_at DESC LIMIT 50 OFFSET $1",
      [(page - 1) * 50],
    );
  }

  async get(id: string): Promise<OrderRow | undefined> {
    const rows = await this.db.query<OrderRow>(
      "SELECT id, created_at AS createdAt FROM orders WHERE id = $1",
      [id],
    );
    return rows[0];
  }
}
