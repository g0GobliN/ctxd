import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Invariants that only break once a package is published.
 *
 * The suite otherwise runs inside the workspace, where every package can see
 * every other one whether or not it says so. That masks exactly the defect
 * these tests exist for: 0.1.0 shipped an `@ctxd/api` that found the interface
 * at `../../ui/dist` without declaring `@ctxd/ui` as a dependency. In the
 * repository the directory was there. Installed from npm nothing put it there,
 * so `ctxd ui` answered /api/health and served 404 for the interface itself.
 */

const root = fileURLToPath(new URL("../../", import.meta.url));
const packagesDir = join(root, "packages");

function manifests(): { dir: string; pkg: Record<string, any> }[] {
  return readdirSync(packagesDir)
    .map((dir) => ({ dir, path: join(packagesDir, dir, "package.json") }))
    .filter((entry) => existsSync(entry.path))
    .map((entry) => ({
      dir: entry.dir,
      pkg: JSON.parse(readFileSync(entry.path, "utf8")) as Record<string, any>,
    }));
}

describe("published manifests", () => {
  it("declares @ctxd/ui as a dependency of @ctxd/api", () => {
    const api = manifests().find((entry) => entry.pkg.name === "@ctxd/api");
    assert.ok(api !== undefined, "@ctxd/api must exist");

    // A dependency found by path is still a dependency. Nothing imports
    // @ctxd/ui — the API reads its built files — which is precisely why this
    // was missed and why it is asserted rather than left to review.
    assert.ok(
      api.pkg.dependencies?.["@ctxd/ui"] !== undefined,
      "@ctxd/api serves the interface from @ctxd/ui and must depend on it, " +
        "or an installed ctxd has no interface to serve",
    );
  });

  it("gives every publishable package a files field", () => {
    for (const { dir, pkg } of manifests()) {
      if (pkg.private === true) continue;
      assert.ok(
        Array.isArray(pkg.files) && pkg.files.length > 0,
        `packages/${dir} has no "files" — it would publish its build cache`,
      );
    }
  });

  it("ships dist from every publishable package", () => {
    for (const { dir, pkg } of manifests()) {
      if (pkg.private === true) continue;
      assert.ok(
        (pkg.files as string[]).includes("dist"),
        `packages/${dir} does not ship dist`,
      );
    }
  });

  it("keeps every @ctxd dependency inside the workspace", () => {
    // A workspace package depending on a *published* sibling by version would
    // silently install an older copy from the registry rather than the code in
    // this checkout.
    for (const { dir, pkg } of manifests()) {
      for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
        if (!name.startsWith("@ctxd/")) continue;
        assert.equal(
          range,
          "workspace:*",
          `packages/${dir} depends on ${name} as ${String(range)} rather than workspace:*`,
        );
      }
    }
  });

  it("names a license on everything that publishes", () => {
    for (const { dir, pkg } of manifests()) {
      if (pkg.private === true) continue;
      assert.equal(pkg.license, "MIT", `packages/${dir} has no license`);
    }
  });
});
