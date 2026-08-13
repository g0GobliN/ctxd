import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../platform/config.js";

/**
 * JWT access tokens — the target of the session migration.
 *
 * Access tokens are short-lived precisely because they cannot be revoked: a
 * stolen token stays valid until it expires. Fifteen minutes is the agreed
 * ceiling (Decision #58); raising it re-opens the revocation problem the
 * session store solved.
 */
export interface AccessTokenClaims {
  sub: string;
  iat: number;
  exp: number;
  scope: string[];
}

const ALGORITHM = "sha256";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac(ALGORITHM, config.auth.jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * Verify a token.
 *
 * The signature comparison is timing-safe: a byte-by-byte early return would
 * let an attacker recover a valid signature one character at a time.
 */
export function verifyAccessToken(token: string): AccessTokenClaims | undefined {
  const [header, payload, signature] = token.split(".");
  if (header === undefined || payload === undefined || signature === undefined) return undefined;

  const expected = createHmac(ALGORITHM, config.auth.jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessTokenClaims;
  if (claims.exp * 1000 < Date.now()) return undefined;
  return claims;
}
