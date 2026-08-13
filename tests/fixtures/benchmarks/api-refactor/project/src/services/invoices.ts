import { Database } from "../platform/database.js";

export interface InvoiceRow {
  id: string;
  createdAt: string;
}

export class InvoiceService {
  constructor(private readonly db: Database) {}

  async list(page: number): Promise<InvoiceRow[]> {
    return this.db.query<InvoiceRow>(
      "SELECT id, created_at AS createdAt FROM invoices ORDER BY created_at DESC LIMIT 50 OFFSET $1",
      [(page - 1) * 50],
    );
  }

  async get(id: string): Promise<InvoiceRow | undefined> {
    const rows = await this.db.query<InvoiceRow>(
      "SELECT id, created_at AS createdAt FROM invoices WHERE id = $1",
      [id],
    );
    return rows[0];
  }
}
