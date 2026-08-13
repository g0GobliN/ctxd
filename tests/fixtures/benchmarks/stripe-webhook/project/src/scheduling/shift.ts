import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Shift management for the scheduling subsystem. */
export interface ShiftRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class ShiftService {
  constructor(private readonly db: Database) {}

  /** list for scheduling Shift records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.list", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for scheduling Shift records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.findById", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for scheduling Shift records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.create", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for scheduling Shift records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.update", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for scheduling Shift records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.archive", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for scheduling Shift records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.restore", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for scheduling Shift records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.countBySite", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for scheduling Shift records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.markFaulted", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for scheduling Shift records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.markHealthy", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for scheduling Shift records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.refreshCache", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for scheduling Shift records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.exportReport", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for scheduling Shift records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<ShiftRecord[]> {
    logger.debug("scheduling.importBatch", { siteId, payload });
    const rows = await this.db.query<ShiftRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_shift WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: ShiftRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
