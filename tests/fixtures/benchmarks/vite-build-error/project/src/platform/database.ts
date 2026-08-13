import pg from "pg";
import { config } from "./config.js";

/** The only module permitted to open a database connection. */
export class Database {
  private readonly pool = new pg.Pool({ connectionString: config.database.url });

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }
}
