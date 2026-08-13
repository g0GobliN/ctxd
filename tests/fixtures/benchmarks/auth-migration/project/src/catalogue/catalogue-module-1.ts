import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Product1 management for the catalogue subsystem. */
export interface Product1Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Product1Service {
  constructor(private readonly db: Database) {}

  /** list for catalogue Product1 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.list", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for catalogue Product1 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.findById", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for catalogue Product1 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.create", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for catalogue Product1 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.update", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for catalogue Product1 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.archive", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for catalogue Product1 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.restore", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for catalogue Product1 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.countBySite", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for catalogue Product1 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.markFaulted", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for catalogue Product1 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.markHealthy", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for catalogue Product1 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.refreshCache", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for catalogue Product1 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.exportReport", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for catalogue Product1 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Product1Record[]> {
    logger.debug("catalogue.importBatch", { siteId, payload });
    const rows = await this.db.query<Product1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM catalogue_catalogue_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Product1Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
