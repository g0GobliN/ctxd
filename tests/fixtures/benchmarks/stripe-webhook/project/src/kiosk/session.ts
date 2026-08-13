import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** KioskSession management for the kiosk subsystem. */
export interface KioskSessionRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class KioskSessionService {
  constructor(private readonly db: Database) {}

  /** list for kiosk KioskSession records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.list", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for kiosk KioskSession records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.findById", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for kiosk KioskSession records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.create", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for kiosk KioskSession records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.update", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for kiosk KioskSession records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.archive", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for kiosk KioskSession records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.restore", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for kiosk KioskSession records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.countBySite", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for kiosk KioskSession records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.markFaulted", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for kiosk KioskSession records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.markHealthy", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for kiosk KioskSession records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.refreshCache", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for kiosk KioskSession records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.exportReport", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for kiosk KioskSession records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<KioskSessionRecord[]> {
    logger.debug("kiosk.importBatch", { siteId, payload });
    const rows = await this.db.query<KioskSessionRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_session WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: KioskSessionRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
