import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Invoice1 management for the billing subsystem. */
export interface Invoice1Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Invoice1Service {
  constructor(private readonly db: Database) {}

  /** list for billing Invoice1 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.list", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for billing Invoice1 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.findById", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for billing Invoice1 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.create", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for billing Invoice1 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.update", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for billing Invoice1 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.archive", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for billing Invoice1 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.restore", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for billing Invoice1 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.countBySite", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for billing Invoice1 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.markFaulted", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for billing Invoice1 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.markHealthy", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for billing Invoice1 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.refreshCache", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for billing Invoice1 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.exportReport", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for billing Invoice1 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Invoice1Record[]> {
    logger.debug("billing.importBatch", { siteId, payload });
    const rows = await this.db.query<Invoice1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM billing_billing_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Invoice1Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
