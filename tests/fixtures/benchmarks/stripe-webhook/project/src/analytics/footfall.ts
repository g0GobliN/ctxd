import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** FootfallReport management for the analytics subsystem. */
export interface FootfallReportRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class FootfallReportService {
  constructor(private readonly db: Database) {}

  /** list for analytics FootfallReport records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.list", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for analytics FootfallReport records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.findById", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for analytics FootfallReport records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.create", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for analytics FootfallReport records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.update", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for analytics FootfallReport records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.archive", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for analytics FootfallReport records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.restore", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for analytics FootfallReport records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.countBySite", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for analytics FootfallReport records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.markFaulted", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for analytics FootfallReport records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.markHealthy", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for analytics FootfallReport records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.refreshCache", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for analytics FootfallReport records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.exportReport", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for analytics FootfallReport records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<FootfallReportRecord[]> {
    logger.debug("analytics.importBatch", { siteId, payload });
    const rows = await this.db.query<FootfallReportRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_footfall WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: FootfallReportRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
