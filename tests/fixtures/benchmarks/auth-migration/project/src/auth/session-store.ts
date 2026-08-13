import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/**
 * Server-side session storage.
 *
 * Sessions are opaque random identifiers held in Postgres. This is the module
 * the JWT migration replaces: every caller of `SessionStore` needs an
 * equivalent path through `verifyAccessToken` before this can be deleted.
 *
 * Sessions are revocable by deleting the row. JWTs are not, which is the whole
 * difficulty of the migration — see docs/auth-architecture.md.
 */
export interface SessionRecord {
  id: string;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export class SessionStore {
  constructor(private readonly db: Database) {}

  async create(userId: string, ttlSeconds: number): Promise<SessionRecord> {
    const rows = await this.db.query<SessionRecord>(
      "INSERT INTO sessions (user_id, expires_at) VALUES ($1, now() + $2 * interval '1 second') RETURNING *",
      [userId, ttlSeconds],
    );
    logger.info("session.created", { userId });
    return rows[0] as SessionRecord;
  }

  async verify(sessionId: string): Promise<SessionRecord | undefined> {
    const rows = await this.db.query<SessionRecord>(
      "SELECT * FROM sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()",
      [sessionId],
    );
    return rows[0];
  }

  /** Immediate revocation. A JWT cannot do this without a deny list. */
  async revoke(sessionId: string): Promise<void> {
    await this.db.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [sessionId]);
    logger.info("session.revoked", { sessionId });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1", [userId]);
  }
}
