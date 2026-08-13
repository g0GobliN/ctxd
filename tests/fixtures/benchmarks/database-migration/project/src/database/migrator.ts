import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "../platform/database.js";

/**
 * Migration runner.
 *
 * Migrations are append-only and run in filename order inside a single
 * transaction each. A migration is never rewritten once it has run anywhere:
 * the recorded version is the contract, and editing history would leave two
 * databases claiming the same version with different schemas.
 */
export class Migrator {
  constructor(private readonly db: Database, private readonly dir: string) {}

  async currentVersion(): Promise<number> {
    const rows = await this.db.query<{ version: number }>(
      "SELECT version FROM schema_meta ORDER BY version DESC LIMIT 1",
    );
    return rows[0]?.version ?? 0;
  }

  async pending(): Promise<string[]> {
    const applied = await this.currentVersion();
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) => Number.parseInt(name.slice(0, 3), 10) > applied);
  }

  async run(): Promise<void> {
    for (const name of await this.pending()) {
      const sql = readFileSync(join(this.dir, name), "utf8");
      await this.db.query("BEGIN");
      await this.db.query(sql);
      await this.db.query("INSERT INTO schema_meta (version) VALUES ($1)", [
        Number.parseInt(name.slice(0, 3), 10),
      ]);
      await this.db.query("COMMIT");
    }
  }
}
