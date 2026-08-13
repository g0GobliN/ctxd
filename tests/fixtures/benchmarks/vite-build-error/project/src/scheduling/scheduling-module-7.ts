import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Booking7 management for the scheduling subsystem. */
export interface Booking7Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Booking7Service {
  constructor(private readonly db: Database) {}

  /** list for scheduling Booking7 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.list", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for scheduling Booking7 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.findById", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for scheduling Booking7 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.create", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for scheduling Booking7 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.update", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for scheduling Booking7 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.archive", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for scheduling Booking7 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.restore", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for scheduling Booking7 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.countBySite", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for scheduling Booking7 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.markFaulted", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for scheduling Booking7 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.markHealthy", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for scheduling Booking7 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.refreshCache", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for scheduling Booking7 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.exportReport", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for scheduling Booking7 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Booking7Record[]> {
    logger.debug("scheduling.importBatch", { siteId, payload });
    const rows = await this.db.query<Booking7Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM scheduling_scheduling_module_7 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Booking7Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
