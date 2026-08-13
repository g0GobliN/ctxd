import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Meter3 management for the energy subsystem. */
export interface Meter3Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Meter3Service {
  constructor(private readonly db: Database) {}

  /** list for energy Meter3 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.list", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for energy Meter3 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.findById", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for energy Meter3 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.create", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for energy Meter3 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.update", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for energy Meter3 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.archive", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for energy Meter3 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.restore", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for energy Meter3 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.countBySite", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for energy Meter3 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.markFaulted", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for energy Meter3 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.markHealthy", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for energy Meter3 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.refreshCache", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for energy Meter3 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.exportReport", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for energy Meter3 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Meter3Record[]> {
    logger.debug("energy.importBatch", { siteId, payload });
    const rows = await this.db.query<Meter3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM energy_energy_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Meter3Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
