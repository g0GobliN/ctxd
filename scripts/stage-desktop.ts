/**
 * Assemble what the installed desktop app carries inside it.
 *
 * The window is a webview onto the local API, and the API is a Node program.
 * A person who double-clicks an icon has neither Node nor ctxd installed, so
 * both travel in the bundle:
 *
 *   packages/desktop/sidecar/runtime/node[.exe]   the Node runtime
 *   packages/desktop/sidecar/app/                 ctxd and its dependencies
 *
 * ## Why it installs from the registry rather than copying the workspace
 *
 * `better-sqlite3` is a native module. The binding that works is the one built
 * for *this* platform and this Node ABI, and the only reliable way to get it is
 * to let the package manager resolve it on the machine doing the build — which
 * is why the release workflow runs this on each operating system in turn.
 *
 * Installing the published version also means the app can only be built from
 * something that was actually released: an installer carrying code no one can
 * `npm install` would be a second, unreproducible distribution channel.
 *
 * ## Why the runtime is copied rather than downloaded
 *
 * `process.execPath` is the Node currently running, so it matches the ABI the
 * native module was just built against by construction. Downloading a release
 * tarball would introduce a version that merely ought to match.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const desktop = join(root, "packages", "desktop");
const sidecar = join(desktop, "sidecar");
const runtimeDir = join(sidecar, "runtime");
const appDir = join(sidecar, "app");

/** Which ctxd to bundle. Defaults to the version this checkout would publish. */
function targetVersion(): string {
  const explicit = process.argv.find((arg) => arg.startsWith("--version="));
  if (explicit !== undefined) return explicit.slice("--version=".length);

  const manifest = JSON.parse(
    execFileSync(process.execPath, [
      "-p",
      "JSON.stringify(require('./packages/cli/package.json'))",
    ], { cwd: root, encoding: "utf8" }),
  ) as { version: string };

  return manifest.version;
}

/**
 * Run a command without a shell.
 *
 * On Windows `npm` is a `.cmd` shim, which cannot be executed directly — so the
 * shim is named explicitly rather than reaching for `shell: true`. A shell would
 * concatenate these arguments rather than escape them (DEP0190), and one of them
 * is a version string that comes from a file.
 */
function run(command: string, args: readonly string[], cwd: string): void {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  execFileSync(executable, args as string[], { cwd, stdio: "inherit" });
}

const version = targetVersion();
console.log(`staging ctxd@${version} for ${process.platform}-${process.arch}`);

rmSync(sidecar, { recursive: true, force: true });
mkdirSync(runtimeDir, { recursive: true });
mkdirSync(appDir, { recursive: true });

// 1 — the runtime.
const nodeName = process.platform === "win32" ? "node.exe" : "node";
copyFileSync(process.execPath, join(runtimeDir, nodeName));
console.log(`  runtime: ${process.version} (${statSync(process.execPath).size} bytes)`);

// 2 — the application, resolved for this platform.
writeFileSync(
  join(appDir, "package.json"),
  `${JSON.stringify({ name: "ctxd-desktop-app", private: true, version: "0.0.0" }, null, 2)}\n`,
);
run("npm", ["install", `@ctxd/cli@${version}`, "--omit=dev", "--no-audit", "--no-fund"], appDir);

// 3 — refuse to hand a broken bundle to the packager.
//
// Each of these has already shipped broken once: the interface was missing
// because @ctxd/api never declared @ctxd/ui, and a native module absent here
// fails at the first database call rather than at build time.
const required = [
  join(appDir, "node_modules", "@ctxd", "cli", "dist", "index.js"),
  join(appDir, "node_modules", "@ctxd", "ui", "dist", "index.html"),
  join(runtimeDir, nodeName),
];

for (const path of required) {
  if (!existsSync(path)) {
    console.error(`staging failed: ${path} is missing`);
    process.exit(1);
  }
}

const binding = join(appDir, "node_modules", "better-sqlite3", "build", "Release");
if (!existsSync(binding)) {
  console.error(`staging failed: no native SQLite binding at ${binding}`);
  process.exit(1);
}

console.log(`staged into ${sidecar}`);
console.log(`  app entry: ${join(appDir, "node_modules", "@ctxd", "cli", "dist", "index.js")}`);
console.log(`  interface: present`);
console.log(`  sqlite:    native binding present`);
