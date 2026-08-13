import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createLogger, multiSink, type LogRecord } from "@ctxd/core";
import { redactSecrets } from "@ctxd/utils";

function collector(): { records: LogRecord[]; sink: (record: LogRecord) => void } {
  const records: LogRecord[] = [];
  return { records, sink: (record) => records.push(record) };
}

describe("redactSecrets", () => {
  it("redacts secret-looking keys at any depth", () => {
    const result = redactSecrets({
      apiKey: "sk-live-123",
      nested: { DB_PASSWORD: "hunter2", keep: "visible" },
    }) as Record<string, Record<string, unknown>>;

    assert.equal(result["apiKey"], "[redacted]");
    assert.equal(result["nested"]?.["DB_PASSWORD"], "[redacted]");
    assert.equal(result["nested"]?.["keep"], "visible");
  });

  it("redacts inside arrays", () => {
    const result = redactSecrets([{ token: "abc" }]) as Array<Record<string, unknown>>;
    assert.equal(result[0]?.["token"], "[redacted]");
  });

  it("leaves primitives untouched", () => {
    assert.equal(redactSecrets("plain"), "plain");
    assert.equal(redactSecrets(7), 7);
    assert.equal(redactSecrets(null), null);
  });
});

describe("createLogger", () => {
  it("filters records below the configured level", () => {
    const { records, sink } = collector();
    const log = createLogger({ level: "warn", sink });

    log.debug("debug");
    log.info("info");
    log.warn("warn");
    log.error("error");

    assert.deepEqual(
      records.map((record) => record.level),
      ["warn", "error"],
    );
  });

  it("never writes a secret field", () => {
    const { records, sink } = collector();
    createLogger({ level: "debug", sink }).info("connecting", {
      password: "hunter2",
      host: "127.0.0.1",
    });

    assert.equal(records[0]?.["password"], "[redacted]");
    assert.equal(records[0]?.["host"], "127.0.0.1");
  });

  it("stamps every record with a level, message and timestamp", () => {
    const { records, sink } = collector();
    createLogger({ sink }).info("hello");

    const record = records[0];
    assert.equal(record?.msg, "hello");
    assert.equal(record?.level, "info");
    assert.equal(Number.isNaN(Date.parse(record?.time ?? "")), false);
  });

  it("merges base fields from child loggers", () => {
    const { records, sink } = collector();
    createLogger({ sink }).child({ command: "doctor" }).info("ran");

    assert.equal(records[0]?.["command"], "doctor");
  });

  it("keeps writing to healthy sinks when one throws", () => {
    const { records, sink } = collector();
    const broken = () => {
      throw new Error("disk full");
    };

    createLogger({ sink: multiSink(broken, sink) }).info("survives");
    assert.equal(records.length, 1);
  });
});
