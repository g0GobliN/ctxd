import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Roster management for the scheduling subsystem. */
export interface RosterRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class RosterService {
  constructor(private readonly db: Database) {}

  /** list for scheduling Roster records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.list", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for scheduling Roster records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.findById", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for scheduling Roster records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.create", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for scheduling Roster records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.update", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for scheduling Roster records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.archive", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for scheduling Roster records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.restore", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for scheduling Roster records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.countBySite", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for scheduling Roster records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.markFaulted", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for scheduling Roster records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.markHealthy", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for scheduling Roster records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.refreshCache", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for scheduling Roster records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.exportReport", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for scheduling Roster records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<RosterRecord[]> {
    logger.debug("scheduling.importBatch", { siteId, payload });
    const rows = await this.db.query<RosterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_roster WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: RosterRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
