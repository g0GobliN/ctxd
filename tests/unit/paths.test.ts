import { strict as assert } from "node:assert";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { DATA_SUBDIRECTORIES, ensureDataDir, isWritableDir, resolvePaths } from "@ctxd/core";
import { expandTilde, isSubPath } from "@ctxd/utils";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

describe("expandTilde", () => {
  it("expands a bare tilde to the home directory", () => {
    assert.equal(expandTilde("~", "/home/example"), "/home/example");
  });

  // Paths are compared against the platform's own resolver rather than a
  // literal POSIX string: the same call yields C:\… on Windows, and hardcoding
  // one separator would test the platform instead of the function.
  it("expands a tilde prefix", () => {
    assert.equal(expandTilde("~/.ctxd", "/home/example"), resolve("/home/example", ".ctxd"));
  });

  it("leaves absolute and relative paths alone", () => {
    assert.equal(expandTilde("/var/lib/ctxd", "/home/example"), "/var/lib/ctxd");
    assert.equal(expandTilde("./local", "/home/example"), "./local");
  });

  it("does not expand a tilde inside a path segment", () => {
    assert.equal(expandTilde("/tmp/~backup", "/home/example"), "/tmp/~backup");
  });
});

describe("isSubPath", () => {
  it("accepts the directory itself and its children", () => {
    assert.equal(isSubPath("/a/b", "/a/b"), true);
    assert.equal(isSubPath("/a/b", "/a/b/c"), true);
  });

  it("rejects siblings and escapes", () => {
    assert.equal(isSubPath("/a/b", "/a/bc"), false);
    assert.equal(isSubPath("/a/b", "/a"), false);
  });
});

describe("resolvePaths", () => {
  it("defaults to ~/.ctxd", () => {
    const paths = resolvePaths({ env: {}, home: "/home/example" });
    const expected = resolve("/home/example", ".ctxd");
    assert.equal(paths.dataDir, expected);
    assert.equal(paths.configFile, join(expected, "config.json"));
    assert.equal(paths.dbFile, join(expected, "ctxd.db"));
  });

  it("honours a configured directory", () => {
    const paths = resolvePaths({ directory: "~/custom", env: {}, home: "/home/example" });
    assert.equal(paths.dataDir, resolve("/home/example", "custom"));
  });

  it("lets CTXD_HOME override configuration", () => {
    const paths = resolvePaths({
      directory: "~/custom",
      env: { CTXD_HOME: "/tmp/override" },
      home: "/home/example",
    });
    assert.equal(paths.dataDir, resolve("/tmp/override"));
  });

  it("places every receipt directory inside the data directory", () => {
    const paths = resolvePaths({ env: { CTXD_HOME: "/tmp/x" } });
    assert.equal(paths.contextReceiptsDir, join(paths.dataDir, "context_receipts"));
    assert.equal(paths.changeReceiptsDir, join(paths.dataDir, "change_receipts"));
    assert.equal(paths.dataDir, resolve("/tmp/x"));
  });
});

describe("ensureDataDir", () => {
  it("creates the data directory and every sub-directory", () => {
    const paths = resolvePaths({ env: { CTXD_HOME: join(home.dir, "fresh") } });
    ensureDataDir(paths);

    assert.equal(existsSync(paths.dataDir), true);
    for (const name of DATA_SUBDIRECTORIES) {
      assert.equal(existsSync(join(paths.dataDir, name)), true, `${name} should exist`);
    }
    assert.equal(isWritableDir(paths.dataDir), true);
  });

  it("is safe to run twice", () => {
    const paths = resolvePaths({ env: { CTXD_HOME: join(home.dir, "twice") } });
    ensureDataDir(paths);
    ensureDataDir(paths);
    assert.equal(statSync(paths.dataDir).isDirectory(), true);
  });

  it("reports a missing directory as not writable", () => {
    assert.equal(isWritableDir(join(home.dir, "does-not-exist")), false);
  });
});
