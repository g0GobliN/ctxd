import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Terminal2 management for the kiosk subsystem. */
export interface Terminal2Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Terminal2Service {
  constructor(private readonly db: Database) {}

  /** list for kiosk Terminal2 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.list", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for kiosk Terminal2 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.findById", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for kiosk Terminal2 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.create", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for kiosk Terminal2 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.update", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for kiosk Terminal2 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.archive", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for kiosk Terminal2 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.restore", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for kiosk Terminal2 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.countBySite", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for kiosk Terminal2 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.markFaulted", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for kiosk Terminal2 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.markHealthy", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for kiosk Terminal2 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.refreshCache", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for kiosk Terminal2 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.exportReport", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for kiosk Terminal2 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Terminal2Record[]> {
    logger.debug("kiosk.importBatch", { siteId, payload });
    const rows = await this.db.query<Terminal2Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_kiosk_module_2 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Terminal2Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
