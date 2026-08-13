import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** CameraStream management for the camera subsystem. */
export interface CameraStreamRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class CameraStreamService {
  constructor(private readonly db: Database) {}

  /** list for camera CameraStream records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.list", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for camera CameraStream records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.findById", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for camera CameraStream records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.create", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for camera CameraStream records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.update", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for camera CameraStream records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.archive", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for camera CameraStream records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.restore", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for camera CameraStream records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.countBySite", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for camera CameraStream records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.markFaulted", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for camera CameraStream records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.markHealthy", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for camera CameraStream records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.refreshCache", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for camera CameraStream records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.exportReport", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for camera CameraStream records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<CameraStreamRecord[]> {
    logger.debug("camera.importBatch", { siteId, payload });
    const rows = await this.db.query<CameraStreamRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_stream WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: CameraStreamRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
