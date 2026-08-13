import { Database } from "../platform/database.js";

/** User lookup for authentication. Passwords are argon2id, never reversible. */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  scopes: string[];
  disabledAt: Date | null;
}

export class UserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const rows = await this.db.query<UserRecord>(
      "SELECT id, email, password_hash AS passwordHash, scopes, disabled_at AS disabledAt " +
        "FROM users WHERE lower(email) = lower($1)",
      [email],
    );
    return rows[0];
  }

  async scopesFor(userId: string): Promise<string[]> {
    const rows = await this.db.query<{ scopes: string[] }>(
      "SELECT scopes FROM users WHERE id = $1",
      [userId],
    );
    return rows[0]?.scopes ?? [];
  }
}
