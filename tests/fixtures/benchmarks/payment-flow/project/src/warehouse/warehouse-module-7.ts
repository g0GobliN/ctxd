import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Bin7 management for the warehouse subsystem. */
export interface Bin7Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Bin7Service {
  constructor(private readonly db: Database) {}

  /** list for warehouse Bin7 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.list", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for warehouse Bin7 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.findById", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for warehouse Bin7 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.create", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for warehouse Bin7 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.update", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for warehouse Bin7 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.archive", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for warehouse Bin7 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.restore", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for warehouse Bin7 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.countBySite", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for warehouse Bin7 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.markFaulted", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for warehouse Bin7 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.markHealthy", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for warehouse Bin7 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.refreshCache", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for warehouse Bin7 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.exportReport", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for warehouse Bin7 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Bin7Record[]> {
    logger.debug("warehouse.importBatch", { siteId, payload });
    const rows = await this.db.query<Bin7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM warehouse_warehouse_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Bin7Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
