/**
 * Local API authentication (§62).
 *
 * The API listens on the loopback interface, which is necessary but not
 * sufficient: every process on the machine can reach loopback, and any web page
 * the user visits can make requests to it. So mutating routes require a token,
 * and every request is checked against DNS-rebinding and cross-origin abuse.
 *
 * The token is local, generated on demand, and never leaves the machine.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const TOKEN_FILE = "api-token";
const TOKEN_BYTES = 32;

/**
 * Read the API token, creating one if it does not exist.
 *
 * Written `0600`: the token authorises changes to the user's project memory, so
 * it is treated like a credential even though it never leaves the machine.
 */
export function ensureToken(dataDir: string): string {
  const path = join(dataDir, TOKEN_FILE);

  if (existsSync(path)) {
    const existing = readFileSync(path, "utf8").trim();
    if (existing !== "") return existing;
  }

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  writeFileSync(path, `${token}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows does not honour POSIX modes; the file still lives inside a
    // 0700 data directory.
  }
  return token;
}

/** Compare two tokens without leaking their contents through timing. */
export function tokensMatch(expected: string, supplied: string | undefined): boolean {
  if (supplied === undefined) return false;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Pull the token out of an Authorization header or an X-Ctxd-Token header. */
export function tokenFrom(headers: NodeJS.Dict<string | string[]>): string | undefined {
  const direct = headers["x-ctxd-token"];
  if (typeof direct === "string" && direct !== "") return direct;

  const authorization = headers["authorization"];
  if (typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")) {
    const value = authorization.slice(7).trim();
    if (value !== "") return value;
  }

  return undefined;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Is the Host header one this server should answer to?
 *
 * A browser will happily resolve an attacker-controlled name to 127.0.0.1 and
 * then talk to this server with the user's privileges — DNS rebinding. Pinning
 * the accepted Host to loopback names closes that, because the attacker's page
 * cannot forge the header.
 */
export function isAllowedHost(host: string | undefined): boolean {
  if (host === undefined || host === "") return false;

  // Strip the port; IPv6 literals keep their brackets.
  const withoutPort = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : (host.split(":")[0] ?? "");

  return LOOPBACK_HOSTS.has(withoutPort.toLowerCase());
}

/**
 * Is this Origin allowed to make a request?
 *
 * Requests with no Origin are same-origin or non-browser and are allowed. A
 * request carrying an Origin is cross-site unless that Origin is loopback too.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined || origin === "") return true;

  try {
    const url = new URL(origin);
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) ||
      LOOPBACK_HOSTS.has(`[${url.hostname.toLowerCase()}]`);
  } catch {
    return false;
  }
}
