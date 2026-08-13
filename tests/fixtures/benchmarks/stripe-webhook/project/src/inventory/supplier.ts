import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Supplier management for the inventory subsystem. */
export interface SupplierRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class SupplierService {
  constructor(private readonly db: Database) {}

  /** list for inventory Supplier records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.list", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for inventory Supplier records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.findById", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for inventory Supplier records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.create", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for inventory Supplier records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.update", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for inventory Supplier records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.archive", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for inventory Supplier records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.restore", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for inventory Supplier records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.countBySite", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for inventory Supplier records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.markFaulted", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for inventory Supplier records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.markHealthy", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for inventory Supplier records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.refreshCache", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for inventory Supplier records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.exportReport", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for inventory Supplier records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<SupplierRecord[]> {
    logger.debug("inventory.importBatch", { siteId, payload });
    const rows = await this.db.query<SupplierRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_supplier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: SupplierRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
