import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Ticket4 management for the support subsystem. */
export interface Ticket4Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Ticket4Service {
  constructor(private readonly db: Database) {}

  /** list for support Ticket4 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.list", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for support Ticket4 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.findById", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for support Ticket4 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.create", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for support Ticket4 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.update", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for support Ticket4 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.archive", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for support Ticket4 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.restore", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for support Ticket4 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.countBySite", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for support Ticket4 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.markFaulted", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for support Ticket4 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.markHealthy", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for support Ticket4 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.refreshCache", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for support Ticket4 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.exportReport", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for support Ticket4 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Ticket4Record[]> {
    logger.debug("support.importBatch", { siteId, payload });
    const rows = await this.db.query<Ticket4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM support_support_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Ticket4Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
