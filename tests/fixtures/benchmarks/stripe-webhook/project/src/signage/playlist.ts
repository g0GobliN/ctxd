import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/** Playlist management for the signage subsystem. */
export interface PlaylistRecord {
  id: string;
  siteId: string;
  label: string;
  state: "active" | "idle" | "faulted";
  updatedAt: Date;
}

export class PlaylistService {
  constructor(private readonly db: Database) {}

  /** list for signage Playlist records. */
  async list(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.list", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** findById for signage Playlist records. */
  async findById(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.findById", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** create for signage Playlist records. */
  async create(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.create", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** update for signage Playlist records. */
  async update(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.update", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** archive for signage Playlist records. */
  async archive(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.archive", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** restore for signage Playlist records. */
  async restore(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.restore", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** countBySite for signage Playlist records. */
  async countBySite(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.countBySite", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markFaulted for signage Playlist records. */
  async markFaulted(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.markFaulted", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** markHealthy for signage Playlist records. */
  async markHealthy(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.markHealthy", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** refreshCache for signage Playlist records. */
  async refreshCache(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.refreshCache", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** exportReport for signage Playlist records. */
  async exportReport(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.exportReport", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  /** importBatch for signage Playlist records. */
  async importBatch(siteId: string, payload: Record<string, unknown> = {}): Promise<PlaylistRecord[]> {
    logger.debug("signage.importBatch", { siteId, payload });
    const rows = await this.db.query<PlaylistRecord>(
      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +
        "FROM signage_playlist WHERE site_id = $1 ORDER BY label",
      [siteId],
    );
    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);
  }

  private describe(record: PlaylistRecord): string {
    return `${record.label} (${record.state}) at site ${record.siteId}`;
  }
}
