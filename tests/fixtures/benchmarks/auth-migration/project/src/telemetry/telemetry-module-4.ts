import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Reading4 management for the telemetry subsystem. */
export interface Reading4Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Reading4Service {
  constructor(private readonly db: Database) {}

  /** list for telemetry Reading4 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.list", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for telemetry Reading4 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.findById", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for telemetry Reading4 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.create", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for telemetry Reading4 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.update", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for telemetry Reading4 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.archive", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for telemetry Reading4 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.restore", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for telemetry Reading4 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.countBySite", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for telemetry Reading4 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.markFaulted", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for telemetry Reading4 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.markHealthy", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for telemetry Reading4 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.refreshCache", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for telemetry Reading4 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.exportReport", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for telemetry Reading4 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Reading4Record[]> {
    logger.debug("telemetry.importBatch", { siteId, payload });
    const rows = await this.db.query<Reading4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM telemetry_telemetry_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Reading4Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
