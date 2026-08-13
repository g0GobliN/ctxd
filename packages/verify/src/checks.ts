/**
 * Verification check discovery (§41, §43).
 *
 * §41: don't call a model where deterministic tooling works. Tests, typecheck,
 * lint and build are answered by the project's own scripts, so ctxd reads the
 * manifest and runs what is actually there. A check that does not exist is
 * reported as unavailable — never as passed.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type CheckKind = "typecheck" | "test" | "lint" | "build";

export interface CheckDefinition {
  readonly kind: CheckKind;
  readonly command: string;
  readonly args: readonly string[];
  /** Why ctxd believes this command implements this check. */
  readonly source: string;
}

interface PackageManifest {
  readonly scripts?: Record<string, string>;
  readonly packageManager?: string;
}

function readManifest(dir: string): PackageManifest | undefined {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
  } catch {
    return undefined;
  }
}

/** Which package manager the project pins, defaulting to npm. */
export function detectPackageManager(dir: string): string {
  const manifest = readManifest(dir);
  const pinned = manifest?.packageManager;
  if (pinned !== undefined) {
    const name = pinned.split("@")[0];
    if (name !== undefined && name !== "") return name;
  }
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb"))) return "bun";
  return "npm";
}

/** Script names that implement each check, in preference order. */
const SCRIPT_CANDIDATES: Readonly<Record<CheckKind, readonly string[]>> = {
  typecheck: ["typecheck", "type-check", "tsc", "check-types"],
  test: ["test", "tests", "test:unit"],
  lint: ["lint", "eslint", "lint:check"],
  build: ["build", "compile"],
};

/**
 * Find the commands that implement each check for this project.
 *
 * Node projects are read from `package.json`; Rust, Go and Python fall back to
 * their conventional commands when their manifest is present. Anything else
 * simply yields no checks, which is reported honestly rather than guessed at.
 */
export function discoverChecks(dir: string): CheckDefinition[] {
  const checks: CheckDefinition[] = [];
  const manifest = readManifest(dir);

  if (manifest?.scripts !== undefined) {
    const manager = detectPackageManager(dir);
    const scripts = manifest.scripts;

    for (const kind of Object.keys(SCRIPT_CANDIDATES) as CheckKind[]) {
      const found = SCRIPT_CANDIDATES[kind].find((name) => scripts[name] !== undefined);
      if (found === undefined) continue;
      checks.push({
        kind,
        command: manager,
        args: ["run", found],
        source: `package.json scripts.${found}`,
      });
    }
  }

  if (checks.length === 0 && existsSync(join(dir, "Cargo.toml"))) {
    checks.push(
      { kind: "typecheck", command: "cargo", args: ["check"], source: "Cargo.toml" },
      { kind: "test", command: "cargo", args: ["test"], source: "Cargo.toml" },
      { kind: "build", command: "cargo", args: ["build"], source: "Cargo.toml" },
    );
  }

  if (checks.length === 0 && existsSync(join(dir, "go.mod"))) {
    checks.push(
      { kind: "build", command: "go", args: ["build", "./..."], source: "go.mod" },
      { kind: "test", command: "go", args: ["test", "./..."], source: "go.mod" },
    );
  }

  if (
    checks.length === 0 &&
    (existsSync(join(dir, "pyproject.toml")) || existsSync(join(dir, "requirements.txt")))
  ) {
    checks.push({ kind: "test", command: "pytest", args: [], source: "python project" });
  }

  return checks;
}
