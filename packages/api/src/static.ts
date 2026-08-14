/**
 * Serving the built interface.
 *
 * The API serves its own front end so the browser sees a single origin: the
 * loopback Origin check stays satisfied and there is no second server to run.
 *
 * The only real hazard here is path traversal — a request for
 * `/../../../.ctxd/api-token` must not read the token. Every path is resolved
 * and then checked to be inside the asset root before anything is opened.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/**
 * Resolve a URL path to a file inside `root`, or `undefined` if it escapes.
 *
 * Returns `undefined` rather than throwing so the caller falls through to the
 * normal 404 — a traversal attempt should look exactly like a missing file and
 * reveal nothing about the layout of the disk.
 */
export function resolveAsset(root: string, urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }

  // A NUL byte can truncate a path inside a syscall.
  if (decoded.includes("\0")) return undefined;

  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = resolve(root, relative);
  const rootResolved = resolve(root);

  if (candidate !== rootResolved && !candidate.startsWith(rootResolved + sep)) {
    return undefined;
  }

  try {
    if (!statSync(candidate).isFile()) return undefined;
  } catch {
    return undefined;
  }

  return candidate;
}

export interface StaticResult {
  readonly served: boolean;
}

/**
 * Serve a built asset, falling back to `index.html`.
 *
 * The fallback exists so a reload on any in-app view still loads the app rather
 * than 404ing. It applies only to requests that are not for a file extension,
 * so a genuinely missing script still reports as missing instead of quietly
 * returning HTML that the browser cannot execute.
 */
export function serveStatic(
  root: string,
  urlPath: string,
  response: ServerResponse,
): StaticResult {
  if (!existsSync(root)) return { served: false };

  const requested = urlPath === "/" ? "/index.html" : urlPath;
  let file = resolveAsset(root, requested);

  if (file === undefined) {
    if (extname(requested) !== "") return { served: false };
    file = resolveAsset(root, "index.html");
    if (file === undefined) return { served: false };
  }

  const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, {
    "content-type": type,
    "content-length": statSync(file).size,
    "x-content-type-options": "nosniff",
    // The interface is rebuilt whenever ctxd is; serving it stale would show
    // a version that disagrees with the API behind it.
    "cache-control": "no-cache",
    // Nothing in this page should load from anywhere but itself.
    "content-security-policy":
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });

  createReadStream(file).pipe(response);
  return { served: true };
}

/**
 * Where the built interface lives.
 *
 * Two layouts have to work, and only one of them was handled.
 *
 * In the repository, `packages/api/dist` and `packages/ui/dist` are siblings,
 * so walking up two directories finds it. Installed from npm, the sibling walk
 * lands on `node_modules/@ctxd/ui/dist` — which is correct *when the package
 * manager hoists it there*, and wrong when it nests the dependency instead.
 *
 * Published 0.1.0 got this wrong in a more basic way: `@ctxd/ui` was not a
 * declared dependency of `@ctxd/api` at all, because the interface is found by
 * path rather than imported. Nothing installed it, so `ctxd ui` answered
 * `/api/health` and served 404 for the interface itself. A path-based
 * dependency is still a dependency, and the manifest has to say so.
 *
 * Resolution is now asked of Node rather than assumed from the directory
 * layout, with the sibling walk kept as the fallback that makes a source
 * checkout work before anything is installed.
 */
export function defaultUiRoot(fromUrl: string): string {
  const here = new URL(".", fromUrl).pathname;
  const decoded = decodeURIComponent(
    process.platform === "win32" ? here.replace(/^\//, "") : here,
  );
  const sibling = join(decoded, "..", "..", "ui", "dist");

  // The repository layout wins when it is present: a developer running from a
  // checkout should see the interface they just built, not one installed from
  // node_modules by something else.
  if (existsSync(join(sibling, "index.html"))) return sibling;

  try {
    const manifest = createRequire(fromUrl).resolve("@ctxd/ui/package.json");
    return join(dirname(manifest), "dist");
  } catch {
    // Not installed and not a sibling. Returning the sibling path keeps the
    // caller's "does this exist?" check meaningful and its error message
    // pointing somewhere real.
    return sibling;
  }
}
