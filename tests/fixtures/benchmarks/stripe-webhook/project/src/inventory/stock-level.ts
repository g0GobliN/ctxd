import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** StockLevel management for the inventory subsystem. */
export interface StockLevelRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class StockLevelService {
  constructor(private readonly db: Database) {}

  /** list for inventory StockLevel records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.list", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for inventory StockLevel records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.findById", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for inventory StockLevel records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.create", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for inventory StockLevel records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.update", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for inventory StockLevel records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.archive", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for inventory StockLevel records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.restore", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for inventory StockLevel records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.countBySite", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for inventory StockLevel records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.markFaulted", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for inventory StockLevel records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.markHealthy", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for inventory StockLevel records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.refreshCache", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for inventory StockLevel records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.exportReport", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for inventory StockLevel records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<StockLevelRecord[]> {
    logger.debug("inventory.importBatch", { siteId, payload });
    const rows = await this.db.query<StockLevelRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_stock_level WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: StockLevelRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
