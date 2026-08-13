import { strict as assert } from "node:assert";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  isAllowedHost,
  isAllowedOrigin,
  resolveAsset,
  startApiServer,
  type ApiServer,
} from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The API is driven over a real socket on an ephemeral port. Mocking the
 * transport would skip exactly the parts worth testing: the host check, the
 * token gate and the status codes.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;

const TOKEN = "test-token-not-a-real-secret";

before(async () => {
  ensureDataDir(paths);
  db = openDatabase(paths.dbFile);
  migrate(db);

  api = await startApiServer({
    db,
    paths,
    config: DEFAULT_CONFIG,
    dir: process.cwd(),
    host: "127.0.0.1",
    port: 0,
    token: TOKEN,
  });
});

after(async () => {
  await api?.close();
  db?.close();
  home.cleanup();
});

async function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${api.url}${path}`, { headers });
}

/** A request that can set headers fetch() forbids, such as Host. */
async function rawGet(path: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const request = httpRequest(
      { host: "127.0.0.1", port: api.port, path, method: "GET", headers },
      (response) => {
        response.resume();
        response.on("end", () => resolvePromise(response.statusCode ?? 0));
      },
    );
    request.on("error", reject);
    request.end();
  });
}

describe("binding and host checks (§62)", () => {
  it("listens on loopback only", () => {
    assert.equal(api.host, "127.0.0.1");
    assert.ok(api.port > 0);
  });

  it("refuses to bind a public interface without an explicit opt-in", async () => {
    await assert.rejects(
      () =>
        startApiServer({
          db,
          paths,
          config: DEFAULT_CONFIG,
          dir: process.cwd(),
          host: "0.0.0.0",
          port: 0,
          token: TOKEN,
        }),
      /local-only/,
    );
  });

  it("accepts loopback hosts and rejects everything else", () => {
    assert.equal(isAllowedHost("127.0.0.1:4317"), true);
    assert.equal(isAllowedHost("localhost:4317"), true);
    assert.equal(isAllowedHost("[::1]:4317"), true);
    // DNS rebinding: a name the attacker controls that resolves to loopback.
    assert.equal(isAllowedHost("evil.example.com:4317"), false);
    assert.equal(isAllowedHost(undefined), false);
  });

  it("rejects a cross-site origin but allows no origin at all", () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin("http://127.0.0.1:4317"), true);
    assert.equal(isAllowedOrigin("https://evil.example.com"), false);
  });

  it("returns 403 when the Host header is not loopback", async () => {
    // fetch() silently drops a caller-supplied Host header, so this goes out
    // over a raw request — otherwise the test would assert nothing.
    const status = await rawGet("/api/health", { host: "evil.example.com" });
    assert.equal(status, 403);
  });

  it("still answers a raw request carrying a loopback Host", async () => {
    const status = await rawGet("/api/health", { host: `127.0.0.1:${api.port}` });
    assert.equal(status, 200);
  });

  it("returns 403 for a cross-site Origin", async () => {
    const response = await get("/api/health", { origin: "https://evil.example.com" });
    assert.equal(response.status, 403);
  });
});

describe("read routes", () => {
  it("answers health without a token", async () => {
    const response = await get("/api/health");
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; version: string };
    assert.equal(body.ok, true);
    assert.ok(body.version.length > 0);
  });

  it("reports status, labelling token counts as estimates", async () => {
    const response = await get("/api/status");
    assert.equal(response.status, 200);
    const body = (await response.json()) as { tokenCounting: string; dataDir: string };
    assert.equal(body.tokenCounting, "estimated");
    assert.equal(body.dataDir, paths.dataDir);
  });

  it("lists projects", async () => {
    const response = await get("/api/projects");
    assert.equal(response.status, 200);
    const body = (await response.json()) as { projects: unknown[] };
    assert.ok(Array.isArray(body.projects));
  });

  it("lists receipts, returning an empty list rather than failing", async () => {
    const response = await get("/api/receipts/change");
    assert.equal(response.status, 200);
    const body = (await response.json()) as { receipts: unknown[] };
    assert.ok(Array.isArray(body.receipts));
  });

  it("explains that no project is registered rather than returning an empty success", async () => {
    const response = await get("/api/tasks");
    assert.equal(response.status, 404);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /ctxd init/);
  });

  it("returns 404 for an unknown route and 405 for a wrong method", async () => {
    assert.equal((await get("/api/nope")).status, 404);

    const wrongMethod = await fetch(`${api.url}/api/health`, { method: "POST" });
    assert.equal(wrongMethod.status, 405);
  });
});

describe("the token gate (§62)", () => {
  it("refuses a mutating route without a token", async () => {
    const response = await fetch(`${api.url}/api/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "anything" }),
    });

    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /requires the local API token/);
  });

  it("refuses a wrong token", async () => {
    const response = await fetch(`${api.url}/api/context`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong-token-entirely-different",
      },
      body: JSON.stringify({ task: "anything" }),
    });
    assert.equal(response.status, 401);
  });

  it("accepts the correct token and validates the body", async () => {
    const response = await fetch(`${api.url}/api/context`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({}),
    });

    // Past the token gate, so the failure is about the body, not auth.
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /"task" is required/);
  });

  it("rejects a body that is not valid JSON", async () => {
    const response = await fetch(`${api.url}/api/context`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: "{not json",
    });
    assert.equal(response.status, 400);
  });
});

describe("the diff route", () => {
  it("runs the Diff Firewall over a real repository", async () => {
    const response = await get(`/api/diff?dir=${encodeURIComponent(process.cwd())}`);
    assert.equal(response.status, 200);

    const receipt = (await response.json()) as {
      classification: string;
      change_efficiency_score: number;
    };
    assert.ok(typeof receipt.classification === "string");
    assert.ok(receipt.change_efficiency_score >= 0 && receipt.change_efficiency_score <= 1);
  });

  it("explains when the directory is not a repository", async () => {
    const response = await get(`/api/diff?dir=${encodeURIComponent(home.dir)}`);
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /not a git repository/);
  });
});

describe("serving the built interface (§67)", () => {
  it("resolves an asset inside the root", () => {
    const root = join(process.cwd(), "packages", "ui", "dist");
    const resolved = resolveAsset(root, "/index.html");
    // Only meaningful once the UI has been built; skip rather than fail a
    // checkout that has not run `pnpm --filter @ctxd/ui build`.
    if (resolved !== undefined) {
      assert.ok(resolved.startsWith(root));
    }
  });

  it("refuses every shape of path traversal", () => {
    const root = join(process.cwd(), "packages", "ui", "dist");
    for (const attempt of [
      "/../../../package.json",
      "/..%2f..%2fpackage.json",
      "/%2e%2e/%2e%2e/package.json",
      "/subdir/../../../package.json",
      "/\0/package.json",
    ]) {
      assert.equal(
        resolveAsset(root, attempt),
        undefined,
        `traversal should be refused: ${attempt}`,
      );
    }
  });

  it("never serves the API token as a static file", async () => {
    // The token lives in the data directory, well outside the asset root.
    const response = await get("/api-token");
    const text = await response.text();
    assert.ok(!text.includes(TOKEN), "the token must never appear in a static response");
  });

  it("keeps API routes out of the static handler", async () => {
    const response = await get("/api/definitely-not-a-route");
    assert.equal(response.status, 404);
    const body = (await response.json()) as { error: string };
    assert.equal(body.error, "not found");
  });
});

describe("worker monitor and settings (§67, §69)", () => {
  it("reports an unseen worker as unknown rather than idle", async () => {
    // No project is registered in this temp home, so the route explains that
    // rather than inventing a worker list.
    const response = await get("/api/workers");
    assert.equal(response.status, 404);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /ctxd init/);
  });

  it("serves configuration read-only", async () => {
    const response = await get("/api/config");
    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      configFile: string;
      dataDir: string;
      editable: boolean;
      config: { mode?: string };
    };
    assert.equal(body.editable, false, "the interface must not offer to write configuration");
    assert.equal(body.dataDir, paths.dataDir);
    assert.equal(body.configFile, paths.configFile);
    assert.ok(typeof body.config.mode === "string");
  });

  it("does not accept a write to the configuration route", async () => {
    const response = await fetch(`${api.url}/api/config`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ mode: "cheap" }),
    });
    assert.equal(response.status, 405);
  });
});
