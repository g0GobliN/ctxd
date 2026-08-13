import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Report5 management for the reporting subsystem. */
export interface Report5Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Report5Service {
  constructor(private readonly db: Database) {}

  /** list for reporting Report5 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.list", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for reporting Report5 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.findById", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for reporting Report5 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.create", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for reporting Report5 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.update", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for reporting Report5 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.archive", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for reporting Report5 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.restore", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for reporting Report5 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.countBySite", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for reporting Report5 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.markFaulted", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for reporting Report5 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.markHealthy", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for reporting Report5 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.refreshCache", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for reporting Report5 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.exportReport", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for reporting Report5 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Report5Record[]> {
    logger.debug("reporting.importBatch", { siteId, payload });
    const rows = await this.db.query<Report5Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM reporting_reporting_module_5 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Report5Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
