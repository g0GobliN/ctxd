import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Recorder management for the camera subsystem. */
export interface RecorderRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class RecorderService {
  constructor(private readonly db: Database) {}

  /** list for camera Recorder records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.list", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for camera Recorder records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.findById", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for camera Recorder records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.create", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for camera Recorder records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.update", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for camera Recorder records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.archive", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for camera Recorder records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.restore", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for camera Recorder records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.countBySite", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for camera Recorder records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.markFaulted", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for camera Recorder records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.markHealthy", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for camera Recorder records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.refreshCache", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for camera Recorder records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.exportReport", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for camera Recorder records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<RecorderRecord[]> {
    logger.debug("camera.importBatch", { siteId, payload });
    const rows = await this.db.query<RecorderRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_recorder WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: RecorderRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
