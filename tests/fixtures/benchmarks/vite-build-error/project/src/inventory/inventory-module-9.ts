import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** StockItem9 management for the inventory subsystem. */
export interface StockItem9Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class StockItem9Service {
  constructor(private readonly db: Database) {}

  /** list for inventory StockItem9 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.list", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for inventory StockItem9 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.findById", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for inventory StockItem9 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.create", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for inventory StockItem9 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.update", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for inventory StockItem9 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.archive", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for inventory StockItem9 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.restore", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for inventory StockItem9 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.countBySite", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for inventory StockItem9 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.markFaulted", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for inventory StockItem9 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.markHealthy", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for inventory StockItem9 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.refreshCache", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for inventory StockItem9 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.exportReport", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for inventory StockItem9 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<StockItem9Record[]> {
    logger.debug("inventory.importBatch", { siteId, payload });
    const rows = await this.db.query<StockItem9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_inventory_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: StockItem9Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
