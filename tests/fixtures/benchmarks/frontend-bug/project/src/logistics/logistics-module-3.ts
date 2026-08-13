import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Shipment3 management for the logistics subsystem. */
export interface Shipment3Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Shipment3Service {
  constructor(private readonly db: Database) {}

  /** list for logistics Shipment3 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.list", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for logistics Shipment3 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.findById", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for logistics Shipment3 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.create", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for logistics Shipment3 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.update", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for logistics Shipment3 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.archive", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for logistics Shipment3 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.restore", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for logistics Shipment3 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.countBySite", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for logistics Shipment3 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.markFaulted", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for logistics Shipment3 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.markHealthy", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for logistics Shipment3 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.refreshCache", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for logistics Shipment3 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.exportReport", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for logistics Shipment3 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Shipment3Record[]> {
    logger.debug("logistics.importBatch", { siteId, payload });
    const rows = await this.db.query<Shipment3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM logistics_logistics_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Shipment3Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
