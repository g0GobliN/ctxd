/**
 * Generate the additional benchmark scenarios (§26).
 *
 * One benchmark proves the engine works on one task. Several prove it has not
 * been *fitted* to that task — which is the real risk with a hand-tuned
 * ranking function. These two deliberately differ from `stripe-webhook` in the
 * ways most likely to expose overfitting:
 *
 *   auth-migration    — a different domain vocabulary, and a task phrased as a
 *                       migration rather than a bug fix.
 *   vite-build-error  — the answer is in configuration files and a recorded
 *                       bug memory, not in application source at all.
 *
 * Usage: node --experimental-strip-types scripts/generate-benchmarks.ts
 */

import { addBulk, addPlatform, Fixture, writeBenchmarkDefinition } from "./fixture-kit.ts";

/* ------------------------------------------------------------------------ */
/* auth-migration                                                            */
/* ------------------------------------------------------------------------ */

function authMigration(): void {
  const fixture = new Fixture("auth-migration");

  fixture.add(
    "src/auth/session-store.ts",
    `import { Database } from "../platform/database.js";
import { logger } from "../platform/logger.js";

/**
 * Server-side session storage.
 *
 * Sessions are opaque random identifiers held in Postgres. This is the module
 * the JWT migration replaces: every caller of \`SessionStore\` needs an
 * equivalent path through \`verifyAccessToken\` before this can be deleted.
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
`,
    3,
  );

  fixture.add(
    "src/auth/jwt.ts",
    `import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../platform/config.js";

/**
 * JWT access tokens — the target of the session migration.
 *
 * Access tokens are short-lived precisely because they cannot be revoked: a
 * stolen token stays valid until it expires. Fifteen minutes is the agreed
 * ceiling (Decision #58); raising it re-opens the revocation problem the
 * session store solved.
 */
export interface AccessTokenClaims {
  sub: string;
  iat: number;
  exp: number;
  scope: string[];
}

const ALGORITHM = "sha256";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac(ALGORITHM, config.auth.jwtSecret)
    .update(\`\${header}.\${payload}\`)
    .digest("base64url");
  return \`\${header}.\${payload}.\${signature}\`;
}

/**
 * Verify a token.
 *
 * The signature comparison is timing-safe: a byte-by-byte early return would
 * let an attacker recover a valid signature one character at a time.
 */
export function verifyAccessToken(token: string): AccessTokenClaims | undefined {
  const [header, payload, signature] = token.split(".");
  if (header === undefined || payload === undefined || signature === undefined) return undefined;

  const expected = createHmac(ALGORITHM, config.auth.jwtSecret)
    .update(\`\${header}.\${payload}\`)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessTokenClaims;
  if (claims.exp * 1000 < Date.now()) return undefined;
  return claims;
}
`,
    3,
  );

  fixture.add(
    "src/auth/middleware.ts",
    `import type { NextFunction, Request, Response } from "express";
import { SessionStore } from "./session-store.js";
import { verifyAccessToken } from "./jwt.js";

/**
 * Authentication middleware.
 *
 * During the migration both credentials are accepted: a bearer JWT, or the
 * legacy session cookie. The session branch is removed once every client ships
 * the token flow.
 */
export function authenticate(sessions: SessionStore) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const authorization = request.header("authorization");

    if (authorization?.startsWith("Bearer ") === true) {
      const claims = verifyAccessToken(authorization.slice(7));
      if (claims === undefined) {
        response.status(401).send("invalid access token");
        return;
      }
      request.userId = claims.sub;
      next();
      return;
    }

    const sessionId = request.cookies["sid"];
    if (typeof sessionId !== "string") {
      response.status(401).send("not authenticated");
      return;
    }

    const session = await sessions.verify(sessionId);
    if (session === undefined) {
      response.status(401).send("session expired");
      return;
    }

    request.userId = session.userId;
    next();
  };
}
`,
    4,
  );

  fixture.add(
    "src/auth/user-repository.ts",
    `import { Database } from "../platform/database.js";

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
`,
    6,
  );

  const authArchitecture = `The API authenticates every request through \`src/auth/middleware.ts\`.

## Today

Opaque session identifiers stored in Postgres. Revocation is a row update, so
signing a user out is immediate and complete.

## Target

Short-lived JWT access tokens plus a long-lived refresh token. Access tokens
carry scopes so the API stops querying the user table on every request.

## The hard part

A JWT cannot be revoked before it expires. The migration therefore keeps the
access-token lifetime short (15 minutes) and holds a deny list of refresh
tokens. Anyone proposing a longer lifetime is re-opening a problem the session
store had already solved.

## Order of work

1. Issue both credentials.
2. Accept both in middleware.
3. Move clients to the token flow.
4. Delete the session path only when no client sends a cookie.`;

  fixture.addDoc("docs/auth-architecture.md", "P1", "Authentication architecture", authArchitecture, 12);

  // A near-duplicate that must be deduplicated away.
  fixture.addDoc(
    "docs/auth-architecture-copy.md",
    "P3",
    "Authentication architecture",
    `${authArchitecture}\n`,
    40,
  );

  fixture.addDoc(
    "docs/rules.md",
    "P0",
    "Project rules",
    `These rules are binding. A change that violates one is wrong even if the
tests pass.

1. Access tokens must never live longer than 15 minutes.
2. Only \`src/auth\` may verify credentials.
3. Only \`src/platform\` may open database connections.
4. Password hashes must never be logged, returned by an API, or copied into a
   token claim.
5. A signature comparison must be timing-safe.`,
    20,
  );

  fixture.addMemory(
    "session-fixation-incident",
    "P1",
    "Session fixation incident, March",
    `A session identifier was accepted from a query parameter as well as a
cookie, so a crafted link logged a victim into the attacker's session.

Fix: identifiers are read from the cookie only, and a new identifier is issued
on every privilege change. The JWT migration must not reintroduce credential
acceptance from the URL.`,
    30,
  );

  fixture.addMemory(
    "decision-58-token-lifetime",
    "P1",
    "Decision #58 — access token lifetime",
    `Question: how long should a JWT access token live?

Decision: 15 minutes, with a refresh token rotating on each use.

Reason: tokens cannot be revoked. A long lifetime converts a single stolen
token into a long-lived compromise.

Status: ACTIVE.`,
    25,
  );

  fixture.add(
    "tests/auth/jwt.test.ts",
    `import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { signAccessToken, verifyAccessToken } from "../../src/auth/jwt.js";

describe("access tokens", () => {
  it("round-trips valid claims", () => {
    const token = signAccessToken({
      sub: "user-1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      scope: ["read"],
    });
    assert.equal(verifyAccessToken(token)?.sub, "user-1");
  });

  it("rejects an expired token", () => {
    const token = signAccessToken({ sub: "u", iat: 0, exp: 1, scope: [] });
    assert.equal(verifyAccessToken(token), undefined);
  });

  it("rejects a tampered signature", () => {
    const token = signAccessToken({
      sub: "user-1",
      iat: 0,
      exp: Math.floor(Date.now() / 1000) + 900,
      scope: [],
    });
    assert.equal(verifyAccessToken(\`\${token}x\`), undefined);
  });
});
`,
    5,
  );

  fixture.add(
    "src/platform/config.ts",
    `export const config = {
  auth: {
    jwtSecret: process.env["JWT_SECRET"] ?? "",
    accessTokenSeconds: 900,
  },
  database: { url: process.env["DATABASE_URL"] ?? "" },
};
`,
    35,
  );

  addPlatform(fixture);

  // A large body of unrelated but plausible product code.
  addBulk(
    fixture,
    [
      { dir: "inventory", domain: "inventory", entity: "StockItem" },
      { dir: "logistics", domain: "logistics", entity: "Shipment" },
      { dir: "reporting", domain: "reporting", entity: "Report" },
      { dir: "facilities", domain: "facilities", entity: "Asset" },
      { dir: "catalogue", domain: "catalogue", entity: "Product" },
      { dir: "telemetry", domain: "telemetry", entity: "Reading" },
    ],
    9,
  );

  fixture.addSecret("JWT_SECRET=fixture-not-a-real-secret\nDATABASE_URL=postgres://fixture/db\n");

  const root = fixture.write();
  writeBenchmarkDefinition({
    name: "auth-migration",
    task: "Migrate session authentication to JWT access tokens",
    budget: 10000,
    minCandidateTokens: 50000,
    mustInclude: ["src/auth/session-store.ts", "src/auth/jwt.ts", "docs/rules.md"],
    shouldInclude: [
      "src/auth/middleware.ts",
      "docs/auth-architecture.md",
      ".ctxd/memory/decision-58-token-lifetime.md",
    ],
    mustExclude: [
      "src/inventory/inventory-module-1.ts",
      "src/logistics/logistics-module-1.ts",
      "src/reporting/reporting-module-1.ts",
      "src/facilities/facilities-module-1.ts",
      ".env",
    ],
    mustDeduplicate: [
      { keep: "docs/auth-architecture.md", drop: "docs/auth-architecture-copy.md" },
    ],
  });

  process.stdout.write(`auth-migration: ${fixture.count} files → ${root}\n`);
}

/* ------------------------------------------------------------------------ */
/* vite-build-error                                                          */
/* ------------------------------------------------------------------------ */

function viteBuildError(): void {
  const fixture = new Fixture("vite-build-error");

  fixture.add(
    "apps/web/vite.config.ts",
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Web app dev server.
 *
 * The HMR port is pinned deliberately. Two applications in this repository ran
 * their dev servers on the default port, and whichever started second silently
 * took a different one — so HMR connected to the wrong app. See BUG #91.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  build: { outDir: "dist", sourcemap: true },
});
`,
    2,
  );

  fixture.add(
    "apps/admin/vite.config.ts",
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Admin dev server. Its HMR port must not collide with the web app. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    hmr: { port: 5174 },
  },
  build: { outDir: "dist", sourcemap: true },
});
`,
    2,
  );

  fixture.add(
    "package.json",
    `{
  "name": "fixture-monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --parallel --filter ./apps/* dev",
    "build": "pnpm --filter ./apps/* build",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.7.2"
  }
}
`,
    8,
  );

  fixture.addDoc(
    "docs/rules.md",
    "P0",
    "Project rules",
    `These rules are binding.

1. Every dev server must set \`strictPort: true\`. A silent port fallback is
   worse than a failure — it produces an app that appears to work while hot
   reload updates a different application.
2. Each application owns a dedicated port. Ports are recorded in
   docs/ports.md and must not be reused.
3. Build output goes to \`dist\`; nothing else may be committed.`,
    18,
  );

  fixture.addDoc(
    "docs/ports.md",
    "P1",
    "Reserved ports",
    `| Application | Dev server | HMR |
|---|---|---|
| apps/web | 5173 | 5173 |
| apps/admin | 5174 | 5174 |
| apps/kiosk | 5175 | 5175 |

Adding an application means claiming the next free port here first.`,
    18,
  );

  fixture.addMemory(
    "vite-hmr-port-collision",
    "P1",
    "BUG #91 — Vite HMR port collision",
    `Problem: hot reload updated the wrong application, and the dev build
sometimes failed outright with an address-in-use error.

Cause: multiple applications used the default Vite port. Without
\`strictPort\`, Vite silently fell back to the next free port, so the HMR client
connected to whichever server had claimed the expected one.

Fix: dedicated ports per application with \`strictPort: true\`, recorded in
docs/ports.md.

Status: RESOLVED. A recurrence means someone added an app without claiming a
port.`,
    14,
  );

  fixture.add(
    "apps/kiosk/vite.config.ts",
    `import { defineConfig } from "vite";

/** Kiosk dev server. */
export default defineConfig({
  server: { port: 5175, strictPort: true, hmr: { port: 5175 } },
  build: { outDir: "dist" },
});
`,
    9,
  );

  fixture.add(
    "apps/web/src/main.tsx",
    `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const root = document.getElementById("root");
if (root === null) throw new Error("missing #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    9,
  );

  addPlatform(fixture);

  addBulk(
    fixture,
    [
      { dir: "billing", domain: "billing", entity: "Invoice" },
      { dir: "inventory", domain: "inventory", entity: "StockItem" },
      { dir: "crm", domain: "crm", entity: "Contact" },
      { dir: "scheduling", domain: "scheduling", entity: "Booking" },
      { dir: "documents", domain: "documents", entity: "Document" },
      { dir: "notifications", domain: "notifications", entity: "Notification" },
    ],
    9,
  );

  fixture.addSecret("DATABASE_URL=postgres://fixture/db\nSMTP_PASSWORD=fixture-not-a-real-password\n");

  const root = fixture.write();
  writeBenchmarkDefinition({
    name: "vite-build-error",
    task: "Fix the Vite dev server HMR port collision breaking hot reload",
    budget: 10000,
    minCandidateTokens: 50000,
    mustInclude: ["docs/rules.md", ".ctxd/memory/vite-hmr-port-collision.md"],
    shouldInclude: ["apps/web/vite.config.ts", "docs/ports.md"],
    mustExclude: [
      "src/billing/billing-module-1.ts",
      "src/crm/crm-module-1.ts",
      "src/scheduling/scheduling-module-1.ts",
      "src/documents/documents-module-1.ts",
      ".env",
    ],
    mustDeduplicate: [],
  });

  process.stdout.write(`vite-build-error: ${fixture.count} files → ${root}\n`);
}

authMigration();
viteBuildError();
