import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Display9 management for the signage subsystem. */
export interface Display9Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Display9Service {
  constructor(private readonly db: Database) {}

  /** list for signage Display9 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.list", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for signage Display9 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.findById", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for signage Display9 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.create", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for signage Display9 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.update", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for signage Display9 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.archive", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for signage Display9 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.restore", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for signage Display9 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.countBySite", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for signage Display9 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.markFaulted", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for signage Display9 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.markHealthy", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for signage Display9 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.refreshCache", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for signage Display9 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.exportReport", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for signage Display9 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Display9Record[]> {
    logger.debug("signage.importBatch", { siteId, payload });
    const rows = await this.db.query<Display9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_signage_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Display9Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
