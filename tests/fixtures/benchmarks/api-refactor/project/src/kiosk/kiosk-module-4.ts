import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Terminal4 management for the kiosk subsystem. */
export interface Terminal4Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Terminal4Service {
  constructor(private readonly db: Database) {}

  /** list for kiosk Terminal4 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.list", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for kiosk Terminal4 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.findById", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for kiosk Terminal4 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.create", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for kiosk Terminal4 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.update", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for kiosk Terminal4 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.archive", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for kiosk Terminal4 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.restore", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for kiosk Terminal4 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.countBySite", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for kiosk Terminal4 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.markFaulted", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for kiosk Terminal4 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.markHealthy", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for kiosk Terminal4 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.refreshCache", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for kiosk Terminal4 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.exportReport", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for kiosk Terminal4 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal4Record[]> {
    logger.debug("kiosk.importBatch", { siteId, payload });
    const rows = await this.db.query<Terminal4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Terminal4Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
