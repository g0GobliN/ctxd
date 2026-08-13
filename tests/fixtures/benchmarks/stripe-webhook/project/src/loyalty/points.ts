import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** PointsLedger management for the loyalty subsystem. */
export interface PointsLedgerRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class PointsLedgerService {
  constructor(private readonly db: Database) {}

  /** list for loyalty PointsLedger records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.list", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for loyalty PointsLedger records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.findById", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for loyalty PointsLedger records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.create", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for loyalty PointsLedger records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.update", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for loyalty PointsLedger records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.archive", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for loyalty PointsLedger records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.restore", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for loyalty PointsLedger records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.countBySite", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for loyalty PointsLedger records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.markFaulted", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for loyalty PointsLedger records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.markHealthy", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for loyalty PointsLedger records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.refreshCache", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for loyalty PointsLedger records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.exportReport", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for loyalty PointsLedger records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<PointsLedgerRecord[]> {
    logger.debug("loyalty.importBatch", { siteId, payload });
    const rows = await this.db.query<PointsLedgerRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM loyalty_points WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: PointsLedgerRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
