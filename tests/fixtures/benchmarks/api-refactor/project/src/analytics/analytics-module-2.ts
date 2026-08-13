import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Metric2 management for the analytics subsystem. */
export interface Metric2Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Metric2Service {
  constructor(private readonly db: Database) {}

  /** list for analytics Metric2 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.list", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for analytics Metric2 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.findById", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for analytics Metric2 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.create", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for analytics Metric2 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.update", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for analytics Metric2 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.archive", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for analytics Metric2 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.restore", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for analytics Metric2 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.countBySite", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for analytics Metric2 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.markFaulted", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for analytics Metric2 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.markHealthy", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for analytics Metric2 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.refreshCache", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for analytics Metric2 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.exportReport", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for analytics Metric2 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Metric2Record[]> {
    logger.debug("analytics.importBatch", { siteId, payload });
    const rows = await this.db.query<Metric2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM analytics_analytics_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Metric2Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
