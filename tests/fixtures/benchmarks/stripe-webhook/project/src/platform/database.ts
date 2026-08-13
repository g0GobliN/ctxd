import pg from "pg";
import { config } from "./config.js";

/** The only module permitted to open a database connection. */
export class Database {
  private readonly pool = new pg.Pool({ connectionString: config.database.url });

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T> {
    const rows = await this.query<T>(sql, params);
    return rows[0] as T;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const result = await this.pool.query(sql, params);
    return { rowCount: result.rowCount ?? 0 };
  }
}
