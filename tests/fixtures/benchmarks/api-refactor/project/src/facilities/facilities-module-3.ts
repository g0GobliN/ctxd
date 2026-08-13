import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Asset3 management for the facilities subsystem. */
export interface Asset3Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Asset3Service {
  constructor(private readonly db: Database) {}

  /** list for facilities Asset3 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.list", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for facilities Asset3 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.findById", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for facilities Asset3 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.create", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for facilities Asset3 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.update", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for facilities Asset3 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.archive", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for facilities Asset3 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.restore", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for facilities Asset3 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.countBySite", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for facilities Asset3 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.markFaulted", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for facilities Asset3 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.markHealthy", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for facilities Asset3 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.refreshCache", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for facilities Asset3 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.exportReport", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for facilities Asset3 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Asset3Record[]> {
    logger.debug("facilities.importBatch", { siteId, payload });
    const rows = await this.db.query<Asset3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM facilities_facilities_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Asset3Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
