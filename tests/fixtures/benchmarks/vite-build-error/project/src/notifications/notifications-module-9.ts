import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Notification9 management for the notifications subsystem. */
export interface Notification9Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Notification9Service {
  constructor(private readonly db: Database) {}

  /** list for notifications Notification9 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.list", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for notifications Notification9 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.findById", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for notifications Notification9 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.create", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for notifications Notification9 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.update", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for notifications Notification9 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.archive", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for notifications Notification9 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.restore", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for notifications Notification9 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.countBySite", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for notifications Notification9 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.markFaulted", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for notifications Notification9 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.markHealthy", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for notifications Notification9 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.refreshCache", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for notifications Notification9 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.exportReport", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for notifications Notification9 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Notification9Record[]> {
    logger.debug("notifications.importBatch", { siteId, payload });
    const rows = await this.db.query<Notification9Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM notifications_notifications_module_9 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Notification9Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
