import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Vehicle2 management for the fleet subsystem. */
export interface Vehicle2Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Vehicle2Service {
  constructor(private readonly db: Database) {}

  /** list for fleet Vehicle2 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.list", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for fleet Vehicle2 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.findById", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for fleet Vehicle2 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.create", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for fleet Vehicle2 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.update", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for fleet Vehicle2 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.archive", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for fleet Vehicle2 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.restore", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for fleet Vehicle2 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.countBySite", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for fleet Vehicle2 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.markFaulted", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for fleet Vehicle2 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.markHealthy", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for fleet Vehicle2 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.refreshCache", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for fleet Vehicle2 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.exportReport", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for fleet Vehicle2 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Vehicle2Record[]> {
    logger.debug("fleet.importBatch", { siteId, payload });
    const rows = await this.db.query<Vehicle2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM fleet_fleet_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Vehicle2Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
