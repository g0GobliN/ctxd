import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Contact6 management for the crm subsystem. */
export interface Contact6Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Contact6Service {
  constructor(private readonly db: Database) {}

  /** list for crm Contact6 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.list", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for crm Contact6 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.findById", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for crm Contact6 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.create", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for crm Contact6 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.update", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for crm Contact6 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.archive", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for crm Contact6 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.restore", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for crm Contact6 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.countBySite", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for crm Contact6 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.markFaulted", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for crm Contact6 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.markHealthy", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for crm Contact6 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.refreshCache", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for crm Contact6 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.exportReport", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for crm Contact6 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Contact6Record[]> {
    logger.debug("crm.importBatch", { siteId, payload });
    const rows = await this.db.query<Contact6Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM crm_crm_module_6 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Contact6Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
