import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** SignageDevice management for the signage subsystem. */
export interface SignageDeviceRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class SignageDeviceService {
  constructor(private readonly db: Database) {}

  /** list for signage SignageDevice records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.list", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for signage SignageDevice records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.findById", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for signage SignageDevice records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.create", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for signage SignageDevice records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.update", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for signage SignageDevice records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.archive", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for signage SignageDevice records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.restore", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for signage SignageDevice records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.countBySite", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for signage SignageDevice records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.markFaulted", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for signage SignageDevice records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.markHealthy", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for signage SignageDevice records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.refreshCache", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for signage SignageDevice records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.exportReport", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for signage SignageDevice records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<SignageDeviceRecord[]> {
    logger.debug("signage.importBatch", { siteId, payload });
    const rows = await this.db.query<SignageDeviceRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_device WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: SignageDeviceRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
