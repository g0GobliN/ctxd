import { Database } from "../platform/database.js";

export interface ProductRow {
  id: string;
  createdAt: string;
}

export class ProductService {
  constructor(private readonly db: Database) {}

  async list(page: number): Promise<ProductRow[]> {
    return this.db.query<ProductRow>(
      "SELECT id, created_at AS createdAt FROM products ORDER BY created_at DESC LIMIT 50 OFFSET $1",
      [(page - 1) * 50],
    );
  }

  async get(id: string): Promise<ProductRow | undefined> {
    const rows = await this.db.query<ProductRow>(
      "SELECT id, created_at AS createdAt FROM products WHERE id = $1",
      [id],
    );
    return rows[0];
  }
}
