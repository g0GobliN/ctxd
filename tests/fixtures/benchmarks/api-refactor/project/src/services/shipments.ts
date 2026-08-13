import { Database } from "../platform/database.js";

export interface ShipmentRow {
  id: string;
  createdAt: string;
}

export class ShipmentService {
  constructor(private readonly db: Database) {}

  async list(page: number): Promise<ShipmentRow[]> {
    return this.db.query<ShipmentRow>(
      "SELECT id, created_at AS createdAt FROM shipments ORDER BY created_at DESC LIMIT 50 OFFSET $1",
      [(page - 1) * 50],
    );
  }

  async get(id: string): Promise<ShipmentRow | undefined> {
    const rows = await this.db.query<ShipmentRow>(
      "SELECT id, created_at AS createdAt FROM shipments WHERE id = $1",
      [id],
    );
    return rows[0];
  }
}
