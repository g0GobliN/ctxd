/**
 * The local HTTP API (§67, §62).
 *
 * Binds the loopback interface and nothing else. There is no cloud component,
 * no telemetry and no remote access path: this server exists so a local UI can
 * call the same services the CLI calls.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { ensureToken, isAllowedHost, isAllowedOrigin, tokenFrom, tokensMatch } from "./auth.js";
import { HttpError, readJsonBody, sendJson, type Route } from "./http.js";
import { createRoutes, type RouteContext } from "./routes.js";
import { defaultUiRoot, serveStatic } from "./static.js";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4317;

/** Hosts that would expose the API beyond this machine. */
const PUBLIC_HOSTS = new Set(["0.0.0.0", "::", "*"]);

export interface ApiServerOptions extends RouteContext {
  readonly host?: string;
  readonly port?: number;
  /** Override the token; by default one is read from or written to the data dir. */
  readonly token?: string;
  /**
   * Permit binding a non-loopback interface. Off by default and never enabled
   * implicitly — §62 requires 127.0.0.1 and never 0.0.0.0 by default.
   */
  readonly allowNonLoopback?: boolean;
  /**
   * Directory of the built interface. Defaults to packages/ui/dist; pass null
   * to serve the API alone.
   */
  readonly uiRoot?: string | null;
  readonly onRequest?: (line: string) => void;
}

export interface ApiServer {
  readonly server: Server;
  readonly host: string;
  readonly port: number;
  readonly token: string;
  readonly url: string;
  /** Whether a built interface was found and is being served. */
  readonly servingUi: boolean;
  close(): Promise<void>;
}

function matchRoute(routes: readonly Route[], method: string, path: string): Route | undefined {
  return routes.find((route) => route.path === path && route.method === method);
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  routes: readonly Route[],
  token: string,
  uiRoot: string | undefined,
): Promise<void> {
  const method = request.method ?? "GET";

  if (!isAllowedHost(request.headers.host)) {
    sendJson(response, 403, { error: "host not allowed" });
    return;
  }
  if (!isAllowedOrigin(request.headers.origin)) {
    sendJson(response, 403, { error: "origin not allowed" });
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? DEFAULT_HOST}`);
  const route = matchRoute(routes, method, url.pathname);

  // Anything that is not an API route may be a file of the built interface.
  if (route === undefined && uiRoot !== undefined && (method === "GET" || method === "HEAD")) {
    if (!url.pathname.startsWith("/api/") && serveStatic(uiRoot, url.pathname, response).served) {
      return;
    }
  }

  if (route === undefined) {
    const pathExists = routes.some((candidate) => candidate.path === url.pathname);
    sendJson(response, pathExists ? 405 : 404, {
      error: pathExists ? `${method} not allowed on ${url.pathname}` : "not found",
    });
    return;
  }

  if (route.mutating && !tokensMatch(token, tokenFrom(request.headers))) {
    sendJson(response, 401, {
      error: "this route changes state and requires the local API token",
      hint: "send it as Authorization: Bearer <token>; find it with: ctxd ui --print-token",
    });
    return;
  }

  const body = method === "GET" || method === "HEAD" ? undefined : await readJsonBody(request);
  const result = await route.handler({ method, path: url.pathname, query: url.searchParams, body });
  sendJson(response, 200, result);
}

/**
 * Create and start the local API server.
 *
 * Resolves once the socket is listening, so callers know the real port when
 * `0` was requested.
 */
export async function startApiServer(options: ApiServerOptions): Promise<ApiServer> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;

  if (PUBLIC_HOSTS.has(host) && options.allowNonLoopback !== true) {
    throw new Error(
      `refusing to bind ${host}: the ctxd API is local-only. ` +
        "Pass allowNonLoopback explicitly if you truly intend to expose it.",
    );
  }

  const token = options.token ?? ensureToken(options.paths.dataDir);
  const uiRoot =
    options.uiRoot === null ? undefined : (options.uiRoot ?? defaultUiRoot(import.meta.url));
  const routes = createRoutes(options);

  const server = createServer((request, response) => {
    const started = Date.now();
    handle(request, response, routes, token, uiRoot)
      .catch((error: unknown) => {
        if (error instanceof HttpError) {
          sendJson(response, error.status, { error: error.message });
          return;
        }
        // The message is returned because this server is local and the caller
        // is the user; nothing here reaches a third party.
        sendJson(response, 500, { error: (error as Error).message });
      })
      .finally(() => {
        options.onRequest?.(
          `${request.method} ${request.url} ${response.statusCode} ${Date.now() - started}ms`,
        );
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const actualPort = address.port;

  return {
    server,
    host,
    port: actualPort,
    token,
    url: `http://${host}:${actualPort}`,
    servingUi: uiRoot !== undefined && existsSync(uiRoot),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
