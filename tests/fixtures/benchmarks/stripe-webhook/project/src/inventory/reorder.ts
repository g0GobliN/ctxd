import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** ReorderPolicy management for the inventory subsystem. */
export interface ReorderPolicyRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class ReorderPolicyService {
  constructor(private readonly db: Database) {}

  /** list for inventory ReorderPolicy records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.list", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for inventory ReorderPolicy records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.findById", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for inventory ReorderPolicy records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.create", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for inventory ReorderPolicy records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.update", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for inventory ReorderPolicy records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.archive", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for inventory ReorderPolicy records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.restore", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for inventory ReorderPolicy records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.countBySite", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for inventory ReorderPolicy records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.markFaulted", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for inventory ReorderPolicy records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.markHealthy", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for inventory ReorderPolicy records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.refreshCache", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for inventory ReorderPolicy records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.exportReport", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for inventory ReorderPolicy records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<ReorderPolicyRecord[]> {
    logger.debug("inventory.importBatch", { siteId, payload });
    const rows = await this.db.query<ReorderPolicyRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM inventory_reorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: ReorderPolicyRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
