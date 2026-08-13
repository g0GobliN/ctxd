import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Audit1 management for the compliance subsystem. */
export interface Audit1Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Audit1Service {
  constructor(private readonly db: Database) {}

  /** list for compliance Audit1 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.list", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for compliance Audit1 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.findById", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for compliance Audit1 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.create", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for compliance Audit1 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.update", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for compliance Audit1 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.archive", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for compliance Audit1 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.restore", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for compliance Audit1 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.countBySite", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for compliance Audit1 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.markFaulted", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for compliance Audit1 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.markHealthy", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for compliance Audit1 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.refreshCache", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for compliance Audit1 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.exportReport", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for compliance Audit1 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Audit1Record[]> {
    logger.debug("compliance.importBatch", { siteId, payload });
    const rows = await this.db.query<Audit1Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM compliance_compliance_module_1 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Audit1Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
