import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** ReceiptPrinter management for the kiosk subsystem. */
export interface ReceiptPrinterRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class ReceiptPrinterService {
  constructor(private readonly db: Database) {}

  /** list for kiosk ReceiptPrinter records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.list", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for kiosk ReceiptPrinter records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.findById", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for kiosk ReceiptPrinter records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.create", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for kiosk ReceiptPrinter records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.update", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for kiosk ReceiptPrinter records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.archive", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for kiosk ReceiptPrinter records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.restore", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for kiosk ReceiptPrinter records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.countBySite", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for kiosk ReceiptPrinter records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.markFaulted", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for kiosk ReceiptPrinter records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.markHealthy", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for kiosk ReceiptPrinter records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.refreshCache", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for kiosk ReceiptPrinter records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.exportReport", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for kiosk ReceiptPrinter records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<ReceiptPrinterRecord[]> {
    logger.debug("kiosk.importBatch", { siteId, payload });
    const rows = await this.db.query<ReceiptPrinterRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM kiosk_printer WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: ReceiptPrinterRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
