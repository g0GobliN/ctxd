import { strict as assert } from "node:assert";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { DEFAULT_CONFIG, loadConfig, saveConfig, validateConfig } from "@ctxd/core";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

describe("validateConfig", () => {
  it("accepts the documented defaults unchanged", () => {
    const { config, errors } = validateConfig(DEFAULT_CONFIG);
    assert.deepEqual(errors, []);
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  it("fills in every missing field from defaults", () => {
    const { config, errors } = validateConfig({});
    assert.deepEqual(errors, []);
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  it("keeps valid fields and reports only the invalid ones", () => {
    const { config, errors } = validateConfig({
      mode: "cheap",
      logging: { level: "shout" },
    });
    assert.equal(config.mode, "cheap");
    assert.equal(config.logging.level, DEFAULT_CONFIG.logging.level);
    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? "", /logging\.level/);
  });

  it("rejects an out-of-range port but keeps the rest", () => {
    const { config, errors } = validateConfig({ ui: { host: "127.0.0.1", port: 70000 } });
    assert.equal(config.ui.port, DEFAULT_CONFIG.ui.port);
    assert.equal(config.ui.host, "127.0.0.1");
    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? "", /ui\.port/);
  });

  it("rejects non-integer token budgets", () => {
    const { config, errors } = validateConfig({ context: { safetyMarginTokens: 1.5 } });
    assert.equal(config.context.safetyMarginTokens, DEFAULT_CONFIG.context.safetyMarginTokens);
    assert.equal(errors.length, 1);
  });

  it("rejects a non-object config", () => {
    const { config, errors } = validateConfig("nope");
    assert.deepEqual(config, DEFAULT_CONFIG);
    assert.equal(errors.length, 1);
  });

  it("rejects a section that is not an object", () => {
    const { errors } = validateConfig({ ui: 42 });
    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? "", /^ui:/);
  });
});

describe("loadConfig", () => {
  it("returns defaults when no file exists", () => {
    const loaded = loadConfig(join(home.dir, "absent.json"));
    assert.equal(loaded.exists, false);
    assert.deepEqual(loaded.errors, []);
    assert.deepEqual(loaded.config, DEFAULT_CONFIG);
  });

  it("reports invalid JSON instead of throwing", () => {
    const path = join(home.dir, "broken.json");
    writeFileSync(path, "{ not json");
    const loaded = loadConfig(path);
    assert.equal(loaded.exists, true);
    assert.equal(loaded.errors.length, 1);
    assert.match(loaded.errors[0] ?? "", /invalid JSON/);
  });

  it("round-trips a saved config", () => {
    const path = join(home.dir, "config.json");
    saveConfig(path, { ...DEFAULT_CONFIG, mode: "full" });
    const loaded = loadConfig(path);
    assert.equal(loaded.exists, true);
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.config.mode, "full");
  });
});
