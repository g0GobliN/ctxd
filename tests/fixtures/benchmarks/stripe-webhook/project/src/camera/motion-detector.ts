import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** MotionDetector management for the camera subsystem. */
export interface MotionDetectorRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class MotionDetectorService {
  constructor(private readonly db: Database) {}

  /** list for camera MotionDetector records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.list", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for camera MotionDetector records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.findById", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for camera MotionDetector records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.create", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for camera MotionDetector records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.update", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for camera MotionDetector records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.archive", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for camera MotionDetector records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.restore", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for camera MotionDetector records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.countBySite", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for camera MotionDetector records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.markFaulted", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for camera MotionDetector records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.markHealthy", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for camera MotionDetector records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.refreshCache", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for camera MotionDetector records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.exportReport", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for camera MotionDetector records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<MotionDetectorRecord[]> {
    logger.debug("camera.importBatch", { siteId, payload });
    const rows = await this.db.query<MotionDetectorRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM camera_motion_detector WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: MotionDetectorRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
