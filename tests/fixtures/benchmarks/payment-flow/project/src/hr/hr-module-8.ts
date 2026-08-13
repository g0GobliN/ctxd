import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Employee8 management for the hr subsystem. */
export interface Employee8Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Employee8Service {
  constructor(private readonly db: Database) {}

  /** list for hr Employee8 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.list", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for hr Employee8 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.findById", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for hr Employee8 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.create", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for hr Employee8 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.update", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for hr Employee8 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.archive", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for hr Employee8 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.restore", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for hr Employee8 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.countBySite", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for hr Employee8 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.markFaulted", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for hr Employee8 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.markHealthy", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for hr Employee8 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.refreshCache", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for hr Employee8 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.exportReport", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for hr Employee8 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Employee8Record[]> {
    logger.debug("hr.importBatch", { siteId, payload });
    const rows = await this.db.query<Employee8Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM hr_hr_module_8 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Employee8Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
