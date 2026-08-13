import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** TierPolicy management for the loyalty subsystem. */
export interface TierPolicyRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class TierPolicyService {
  constructor(private readonly db: Database) {}

  /** list for loyalty TierPolicy records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.list", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for loyalty TierPolicy records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.findById", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for loyalty TierPolicy records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.create", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for loyalty TierPolicy records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.update", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for loyalty TierPolicy records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.archive", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for loyalty TierPolicy records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.restore", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for loyalty TierPolicy records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.countBySite", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for loyalty TierPolicy records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.markFaulted", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for loyalty TierPolicy records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.markHealthy", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for loyalty TierPolicy records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.refreshCache", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for loyalty TierPolicy records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.exportReport", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for loyalty TierPolicy records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<TierPolicyRecord[]> {
    logger.debug("loyalty.importBatch", { siteId, payload });
    const rows = await this.db.query<TierPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_tier WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: TierPolicyRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
