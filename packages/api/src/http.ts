/**
 * HTTP plumbing for the local API.
 *
 * Small on purpose: ctxd adds no web framework for a server that answers a
 * couple of dozen local routes.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

/** Largest request body accepted, so a local process cannot exhaust memory. */
export const MAX_BODY_BYTES = 1024 * 1024;

export interface RouteRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  /** Parsed JSON body, or undefined when there was none. */
  readonly body: unknown;
}

export type RouteHandler = (request: RouteRequest) => Promise<unknown> | unknown;

export interface Route {
  readonly method: string;
  readonly path: string;
  /** Mutating routes require the local token (§62). */
  readonly mutating: boolean;
  readonly handler: RouteHandler;
}

/** An error carrying the status code it should produce. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    // The API answers data, never markup; these stop a browser from being
    // talked into treating a response as something executable.
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  response.end(body);
}

/**
 * Read and parse a JSON request body.
 *
 * Rejects anything over the size limit rather than buffering it, and treats an
 * empty body as "no body" rather than as invalid JSON.
 */
export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, `request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (text === "") return undefined;

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "request body is not valid JSON");
  }
}

/** Read a string field from a parsed body, enforcing its presence. */
export function requireString(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `"${field}" is required and must be a non-empty string`);
  }
  return value;
}

/** Read an optional string field. */
export function optionalString(body: unknown, field: string): string | undefined {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new HttpError(400, `"${field}" must be a string`);
  }
  return value;
}

/** Read a positive integer field. */
export function optionalInt(body: unknown, field: string): number | undefined {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `"${field}" must be a positive integer`);
  }
  return parsed;
}
