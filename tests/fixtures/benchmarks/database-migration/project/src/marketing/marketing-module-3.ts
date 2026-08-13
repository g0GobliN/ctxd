import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Campaign3 management for the marketing subsystem. */
export interface Campaign3Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Campaign3Service {
  constructor(private readonly db: Database) {}

  /** list for marketing Campaign3 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.list", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for marketing Campaign3 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.findById", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for marketing Campaign3 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.create", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for marketing Campaign3 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.update", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for marketing Campaign3 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.archive", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for marketing Campaign3 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.restore", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for marketing Campaign3 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.countBySite", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for marketing Campaign3 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.markFaulted", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for marketing Campaign3 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.markHealthy", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for marketing Campaign3 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.refreshCache", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for marketing Campaign3 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.exportReport", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for marketing Campaign3 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Campaign3Record[]> {
    logger.debug("marketing.importBatch", { siteId, payload });
    const rows = await this.db.query<Campaign3Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM marketing_marketing_module_3 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Campaign3Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
