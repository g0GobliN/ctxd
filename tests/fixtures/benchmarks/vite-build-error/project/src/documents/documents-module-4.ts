import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Document4 management for the documents subsystem. */
export interface Document4Record {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class Document4Service {
  constructor(private readonly db: Database) {}

  /** list for documents Document4 records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.list", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for documents Document4 records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.findById", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for documents Document4 records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.create", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for documents Document4 records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.update", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for documents Document4 records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.archive", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for documents Document4 records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.restore", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for documents Document4 records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.countBySite", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for documents Document4 records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.markFaulted", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for documents Document4 records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.markHealthy", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for documents Document4 records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.refreshCache", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for documents Document4 records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.exportReport", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for documents Document4 records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<Document4Record[]> {
    logger.debug("documents.importBatch", { siteId, payload });
    const rows = await this.db.query<Document4Record>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM documents_documents_module_4 WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: Document4Record): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
