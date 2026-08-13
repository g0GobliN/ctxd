/**
 * Shared machinery for generating benchmark fixtures.
 *
 * A benchmark is only meaningful if the irrelevant material is *plausible*: a
 * repository of obviously-fake files would be trivially easy to rank. So the
 * bulk modules here are shaped like real service code — imports, interfaces,
 * repeated CRUD methods, log lines — and simply have nothing to do with the
 * task under test.
 *
 * Everything is deterministic: same inputs, same bytes, same mtimes on every
 * run, because the benchmark asserts byte-identical output.
 */

import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Fixed clock so generated mtimes never drift between runs. */
export const NOW = Date.parse("2026-08-01T12:00:00Z");
export const DAY = 86_400_000;

export const BENCHMARKS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "tests",
  "fixtures",
  "benchmarks",
);

export interface FixtureFile {
  readonly path: string;
  readonly content: string;
  readonly ageDays: number;
}

/**
 * Collects files for one fixture repository.
 *
 * Plain field assignment rather than a constructor parameter property: these
 * scripts run under `--experimental-strip-types`, which erases annotations but
 * cannot emit the assignment a parameter property implies.
 */
export class Fixture {
  readonly name: string;
  private readonly files: FixtureFile[] = [];

  constructor(name: string) {
    this.name = name;
  }

  add(path: string, content: string, ageDays: number): this {
    this.files.push({ path, content, ageDays });
    return this;
  }

  /** A markdown document with a ctxd priority in its front matter. */
  addDoc(path: string, priority: string, title: string, body: string, ageDays: number): this {
    return this.add(
      path,
      `---\npriority: ${priority}\n---\n\n# ${title}\n\n${body}\n`,
      ageDays,
    );
  }

  /** A project memory record, as `ctxd memory` would write it. */
  addMemory(slug: string, priority: string, title: string, body: string, ageDays: number): this {
    return this.add(
      `.ctxd/memory/${slug}.md`,
      `---\npriority: ${priority}\ntype: MEMORY\n---\n\n# ${title}\n\n${body}\n`,
      ageDays,
    );
  }

  /**
   * A secret that must never be collected.
   *
   * Every fixture needs one: the "never collects secrets" assertion proves
   * nothing against a repository that contains no secret.
   */
  addSecret(body: string): this {
    return this.add(".env", body, 10);
  }

  get count(): number {
    return this.files.length;
  }

  /** Write the fixture, replacing any previous copy. */
  write(): string {
    const root = join(BENCHMARKS_DIR, this.name, "project");
    rmSync(root, { recursive: true, force: true });

    for (const file of this.files) {
      const absolute = join(root, file.path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, file.content);

      const seconds = (NOW - file.ageDays * DAY) / 1000;
      utimesSync(absolute, seconds, seconds);
    }

    return root;
  }
}

export interface BenchmarkDefinition {
  readonly name: string;
  readonly task: string;
  readonly budget: number;
  readonly minCandidateTokens: number;
  readonly mustInclude: readonly string[];
  readonly shouldInclude: readonly string[];
  readonly mustExclude: readonly string[];
  readonly mustDeduplicate: readonly { keep: string; drop: string }[];
}

export function writeBenchmarkDefinition(definition: BenchmarkDefinition): void {
  const path = join(BENCHMARKS_DIR, definition.name, "benchmark.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(definition, null, 2)}\n`);
}

export interface BulkModule {
  /** Directory under `src/`. */
  readonly dir: string;
  /** File name without extension. */
  readonly name: string;
  /** Subsystem label used in comments and SQL. */
  readonly domain: string;
  /** Type name used throughout the module. */
  readonly entity: string;
}

const OPERATIONS = [
  "list", "findById", "create", "update", "archive", "restore",
  "countBySite", "markFaulted", "markHealthy", "refreshCache",
  "exportReport", "importBatch",
];

/**
 * A plausible service module with no bearing on any benchmark task.
 *
 * Deliberately verbose: the point of a benchmark is that the engine must reject
 * a large volume of realistic-looking code, and a three-line stub would not
 * exert that pressure.
 */
export function bulkModule(module: BulkModule): string {
  const { domain, entity } = module;
  const table = `${domain}_${module.name.replace(/-/g, "_")}`;

  const lines: string[] = [
    `import { Database } from "../platform/database.js";`,
    `import { logger } from "../platform/logger.js";`,
    ``,
    `/** ${entity} management for the ${domain} subsystem. */`,
    `export interface ${entity}Record {`,
    `  id: string;`,
    `  siteId: string;`,
    `  label: string;`,
    `  state: "active" | "idle" | "faulted";`,
    `  updatedAt: Date;`,
    `}`,
    ``,
    `export class ${entity}Service {`,
    `  constructor(private readonly db: Database) {}`,
    ``,
  ];

  for (const operation of OPERATIONS) {
    lines.push(
      `  /** ${operation} for ${domain} ${entity} records. */`,
      `  async ${operation}(siteId: string, payload: Record<string, unknown> = {}): Promise<${entity}Record[]> {`,
      `    logger.debug("${domain}.${operation}", { siteId, payload });`,
      `    const rows = await this.db.query<${entity}Record>(`,
      `      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +`,
      `        "FROM ${table} WHERE site_id = $1 ORDER BY label",`,
      `      [siteId],`,
      `    );`,
      `    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);`,
      `  }`,
      ``,
    );
  }

  lines.push(
    `  private describe(record: ${entity}Record): string {`,
    `    return \`\${record.label} (\${record.state}) at site \${record.siteId}\`;`,
    `  }`,
    `}`,
    ``,
  );

  return lines.join("\n");
}

/** The platform modules bulk code imports, so the fixture type-checks by eye. */
export function addPlatform(fixture: Fixture): void {
  fixture.add(
    "src/platform/database.ts",
    `import pg from "pg";
import { config } from "./config.js";

/** The only module permitted to open a database connection. */
export class Database {
  private readonly pool = new pg.Pool({ connectionString: config.database.url });

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }
}
`,
    35,
  );

  fixture.add(
    "src/platform/logger.ts",
    `export const logger = {
  debug: (msg: string, fields?: unknown) => emit("debug", msg, fields),
  info: (msg: string, fields?: unknown) => emit("info", msg, fields),
  error: (msg: string, fields?: unknown) => emit("error", msg, fields),
};

function emit(level: string, msg: string, fields?: unknown): void {
  process.stdout.write(\`\${JSON.stringify({ level, msg, fields })}\\n\`);
}
`,
    35,
  );
}

/** Generate `count` bulk modules spread across the given subsystems. */
export function addBulk(
  fixture: Fixture,
  subsystems: readonly { dir: string; domain: string; entity: string }[],
  perSubsystem: number,
  ageDays = 45,
): void {
  for (const subsystem of subsystems) {
    for (let i = 0; i < perSubsystem; i += 1) {
      const name = `${subsystem.dir}-module-${i + 1}`;
      fixture.add(
        `src/${subsystem.dir}/${name}.ts`,
        bulkModule({ ...subsystem, name, entity: `${subsystem.entity}${i + 1}` }),
        ageDays,
      );
    }
  }
}
