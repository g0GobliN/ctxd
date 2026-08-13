import { strict as assert } from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { migrate, openDatabase } from "@ctxd/db";
import {
  detectProject,
  findProjectByRoot,
  indexProjectFiles,
  languageOf,
  listProjects,
  projectId,
  upsertProject,
  writeProjectStorage,
} from "@ctxd/project";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

function makeProject(name: string, files: Record<string, string>): string {
  const root = join(home.dir, name);
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(join(absolute, ".."), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

function freshDb(name: string) {
  const db = openDatabase(join(home.dir, `${name}.db`));
  migrate(db);
  return db;
}

describe("detectProject", () => {
  it("reads the stack from real files, not directory names", () => {
    const root = makeProject("node-app", {
      "package.json": JSON.stringify({
        name: "checkout-api",
        dependencies: { express: "^4.19.0" },
        devDependencies: { typescript: "^5.6.0" },
      }),
      "tsconfig.json": "{}",
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
      "src/index.ts": "export const start = () => {};",
    });

    const project = detectProject(root);
    assert.equal(project.name, "checkout-api");
    assert.equal(project.runtime, "node");
    assert.equal(project.language, "typescript");
    assert.equal(project.packageManager, "pnpm");
    assert.equal(project.framework, "express");
    assert.ok(project.evidence.includes("package.json"));
    assert.ok(project.evidence.includes("pnpm-lock.yaml"));
  });

  it("detects non-JavaScript stacks", () => {
    const rust = detectProject(
      makeProject("rust-app", { "Cargo.toml": "[package]\nname = \"thing\"\n" }),
    );
    assert.equal(rust.language, "rust");
    assert.equal(rust.runtime, "rust");

    const python = detectProject(
      makeProject("py-app", { "pyproject.toml": "[project]\nname = 'thing'\n" }),
    );
    assert.equal(python.language, "python");

    const go = detectProject(makeProject("go-app", { "go.mod": "module example.com/thing\n" }));
    assert.equal(go.language, "go");
    assert.equal(go.packageManager, null);
  });

  it("infers nothing from a suggestive directory name alone", () => {
    const root = makeProject("django", { "notes.txt": "no manifest here" });
    const project = detectProject(root);

    assert.equal(project.runtime, null);
    assert.equal(project.language, null);
    assert.equal(project.framework, null);
    assert.deepEqual(project.evidence, []);
  });

  it("prefers a framework config file when no dependency declares one", () => {
    const root = makeProject("vite-app", {
      "package.json": JSON.stringify({ name: "site" }),
      "vite.config.ts": "export default {};",
    });
    assert.equal(detectProject(root).framework, "vite");
  });

  it("gives the same id for the same directory and different ids for different ones", () => {
    const a = makeProject("id-a", { "package.json": "{}" });
    const b = makeProject("id-b", { "package.json": "{}" });

    assert.equal(detectProject(a).id, detectProject(a).id);
    assert.notEqual(detectProject(a).id, detectProject(b).id);
  });

  it("anchors identity to the root commit when Git provides one", () => {
    const withCommit = projectId("/somewhere", {
      available: true,
      insideWorkTree: true,
      rootCommit: "abc123",
    });
    const movedRepo = projectId("/somewhere-else", {
      available: true,
      insideWorkTree: true,
      rootCommit: "abc123",
    });
    assert.equal(withCommit, movedRepo, "identity should survive a move");
  });
});

describe("project persistence", () => {
  it("registers a project and finds it by root", () => {
    const db = freshDb("register");
    const project = detectProject(
      makeProject("persisted", { "package.json": JSON.stringify({ name: "persisted-app" }) }),
    );

    const row = upsertProject(db, project);
    assert.equal(row.name, "persisted-app");
    assert.equal(findProjectByRoot(db, project.root)?.id, project.id);
    assert.equal(listProjects(db).length, 1);
    db.close();
  });

  it("refreshes rather than duplicating on re-init, keeping created_at", () => {
    const db = freshDb("refresh");
    const root = makeProject("refreshed", {
      "package.json": JSON.stringify({ name: "before" }),
    });

    const first = upsertProject(db, detectProject(root), new Date("2026-01-01T00:00:00Z"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "after" }));
    const second = upsertProject(db, detectProject(root), new Date("2026-02-01T00:00:00Z"));

    assert.equal(listProjects(db).length, 1);
    assert.equal(second.name, "after");
    assert.equal(second.created_at, first.created_at);
    assert.notEqual(second.updated_at, first.updated_at);
    db.close();
  });
});

describe("indexProjectFiles", () => {
  it("indexes every eligible file on the first pass", () => {
    const db = freshDb("index-first");
    const root = makeProject("indexed", {
      "package.json": "{}",
      "src/a.ts": "export const a = 1;",
      "src/b.ts": "export const b = 2;",
      "docs/readme.md": "# docs",
    });
    const project = upsertProject(db, detectProject(root));

    const result = indexProjectFiles(db, project.id, root);
    assert.equal(result.added, 4);
    assert.equal(result.unchanged, 0);
    assert.equal(result.total, 4);
    db.close();
  });

  it("skips unchanged files on the second pass", () => {
    const db = freshDb("index-second");
    const root = makeProject("incremental", { "src/a.ts": "export const a = 1;" });
    const project = upsertProject(db, detectProject(root));

    indexProjectFiles(db, project.id, root);
    const second = indexProjectFiles(db, project.id, root);

    assert.equal(second.added, 0);
    assert.equal(second.updated, 0);
    assert.equal(second.unchanged, 1);
  });

  it("notices a changed file and forgets a deleted one", () => {
    const db = freshDb("index-changes");
    const root = makeProject("changing", {
      "src/a.ts": "export const a = 1;",
      "src/b.ts": "export const b = 2;",
    });
    const project = upsertProject(db, detectProject(root));
    indexProjectFiles(db, project.id, root);

    writeFileSync(join(root, "src/a.ts"), "export const a = 99;");
    rmSync(join(root, "src/b.ts"));
    const result = indexProjectFiles(db, project.id, root);

    assert.equal(result.updated, 1);
    assert.equal(result.removed, 1);
    assert.equal(result.total, 1);

    const rows = db
      .prepare("SELECT path FROM files WHERE project_id = ? ORDER BY path")
      .all(project.id) as { path: string }[];
    assert.deepEqual(rows.map((row) => row.path), ["src/a.ts"]);
    db.close();
  });

  it("never indexes secrets", () => {
    const db = freshDb("index-secrets");
    const root = makeProject("secretive", {
      "src/a.ts": "export const a = 1;",
      ".env": "STRIPE_API_KEY=sk_live_nope",
      ".env.production": "TOKEN=nope",
    });
    const project = upsertProject(db, detectProject(root));
    indexProjectFiles(db, project.id, root);

    const rows = db
      .prepare("SELECT path FROM files WHERE project_id = ?")
      .all(project.id) as { path: string }[];
    for (const row of rows) {
      assert.ok(!row.path.startsWith(".env"), `secret indexed: ${row.path}`);
    }
    db.close();
  });

  it("records a language for known extensions", () => {
    assert.equal(languageOf("src/a.ts"), "typescript");
    assert.equal(languageOf("main.go"), "go");
    assert.equal(languageOf("README.md"), "markdown");
    assert.equal(languageOf("Makefile"), null);
  });

  it("removes indexed files when the project is deleted", () => {
    const db = freshDb("cascade");
    const root = makeProject("cascading", { "src/a.ts": "export const a = 1;" });
    const project = upsertProject(db, detectProject(root));
    indexProjectFiles(db, project.id, root);

    db.prepare("DELETE FROM projects WHERE id = ?").run(project.id);
    const remaining = db
      .prepare("SELECT count(*) AS count FROM files WHERE project_id = ?")
      .get(project.id) as { count: number };

    assert.equal(remaining.count, 0, "foreign key cascade should clean up file rows");
    db.close();
  });
});

describe("writeProjectStorage", () => {
  it("writes generated documents into the project directory", () => {
    const root = makeProject("documented", {
      "package.json": JSON.stringify({ name: "documented-app" }),
    });
    const projectsDir = join(home.dir, "projects-out");
    mkdirSync(projectsDir, { recursive: true });

    const project = detectProject(root);
    const storage = writeProjectStorage(projectsDir, project);

    assert.equal(storage.dir, join(projectsDir, project.id));
    assert.deepEqual([...storage.files].sort(), [
      "agent-instructions.md",
      "git.md",
      "mcp-setup.md",
      "project.md",
      "stack.md",
    ]);
  });
});
