import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** SignageScheduler management for the signage subsystem. */
export interface SignageSchedulerRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class SignageSchedulerService {
  constructor(private readonly db: Database) {}

  /** list for signage SignageScheduler records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.list", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for signage SignageScheduler records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.findById", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for signage SignageScheduler records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.create", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for signage SignageScheduler records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.update", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for signage SignageScheduler records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.archive", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for signage SignageScheduler records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.restore", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for signage SignageScheduler records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.countBySite", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for signage SignageScheduler records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.markFaulted", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for signage SignageScheduler records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.markHealthy", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for signage SignageScheduler records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.refreshCache", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for signage SignageScheduler records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.exportReport", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for signage SignageScheduler records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageSchedulerRecord[]> {
    logger.debug("signage.importBatch", { siteId, payload });
    const rows = await this.db.query<SignageSchedulerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_scheduler WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: SignageSchedulerRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
