import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** DwellTime management for the analytics subsystem. */
export interface DwellTimeRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class DwellTimeService {
  constructor(private readonly db: Database) {}

  /** list for analytics DwellTime records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.list", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for analytics DwellTime records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.findById", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for analytics DwellTime records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.create", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for analytics DwellTime records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.update", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for analytics DwellTime records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.archive", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for analytics DwellTime records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.restore", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for analytics DwellTime records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.countBySite", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for analytics DwellTime records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.markFaulted", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for analytics DwellTime records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.markHealthy", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for analytics DwellTime records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.refreshCache", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for analytics DwellTime records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.exportReport", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for analytics DwellTime records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<DwellTimeRecord[]> {
    logger.debug("analytics.importBatch", { siteId, payload });
    const rows = await this.db.query<DwellTimeRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_dwell_time WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: DwellTimeRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
