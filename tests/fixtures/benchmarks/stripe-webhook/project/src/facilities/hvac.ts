import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** HvacUnit management for the facilities subsystem. */
export interface HvacUnitRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class HvacUnitService {
  constructor(private readonly db: Database) {}

  /** list for facilities HvacUnit records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.list", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for facilities HvacUnit records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.findById", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for facilities HvacUnit records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.create", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for facilities HvacUnit records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.update", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for facilities HvacUnit records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.archive", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for facilities HvacUnit records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.restore", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for facilities HvacUnit records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.countBySite", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for facilities HvacUnit records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.markFaulted", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for facilities HvacUnit records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.markHealthy", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for facilities HvacUnit records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.refreshCache", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for facilities HvacUnit records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.exportReport", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for facilities HvacUnit records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<HvacUnitRecord[]> {
    logger.debug("facilities.importBatch", { siteId, payload });
    const rows = await this.db.query<HvacUnitRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_hvac WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: HvacUnitRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
