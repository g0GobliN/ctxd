import { Database } from "../platform/database.js";

export interface UserRow {
  id: string;
  createdAt: string;
}

export class UserService {
  constructor(private readonly db: Database) {}

  async list(page: number): Promise<UserRow[]> {
    return this.db.query<UserRow>(
      "SELECT id, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 50 OFFSET $1",
      [(page - 1) * 50],
    );
  }

  async get(id: string): Promise<UserRow | undefined> {
    const rows = await this.db.query<UserRow>(
      "SELECT id, created_at AS createdAt FROM users WHERE id = $1",
      [id],
    );
    return rows[0];
  }
}
