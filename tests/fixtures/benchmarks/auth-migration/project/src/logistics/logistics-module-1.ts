import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Shipment1 management for the logistics subsystem. */
export interface Shipment1Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Shipment1Service {
  constructor(private readonly db: Database) {}

  /** list for logistics Shipment1 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.list", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for logistics Shipment1 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.findById", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for logistics Shipment1 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.create", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for logistics Shipment1 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.update", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for logistics Shipment1 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.archive", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for logistics Shipment1 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.restore", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for logistics Shipment1 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.countBySite", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for logistics Shipment1 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.markFaulted", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for logistics Shipment1 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.markHealthy", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for logistics Shipment1 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.refreshCache", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for logistics Shipment1 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.exportReport", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for logistics Shipment1 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment1Record[]> {
    logger.debug("logistics.importBatch", { siteId, payload });
    const rows = await this.db.query<Shipment1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Shipment1Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
