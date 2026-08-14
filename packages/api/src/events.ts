/**
 * The live event stream (§7).
 *
 * ctxd's producers do not run in this process. The MCP server is started by the
 * worker, the CLI by the developer, and this API by `ctxd ui` — three
 * processes sharing no memory. They share SQLite, so a producer appends to the
 * `events` table and this route tails it and forwards what it finds.
 *
 * Polling a local SQLite table is not elegant, but it is honest about what it
 * costs, works identically on every platform, and needs no broker, no daemon
 * and no second port. A file watcher would fire on WAL checkpoints rather than
 * on rows, and a socket would have to be reinvented for Windows.
 */

import { latestEventId, readEvents, recentEvents, type CtxdEvent } from "@ctxd/events";
import type { RouteContext } from "./context.js";
import { HttpError, type Route, type RouteRequest, type StreamSubscription } from "./http.js";
import { projectIdFor } from "./project-scope.js";

/** How often the table is checked for new rows. */
const POLL_MS = 500;

/**
 * How long a silent stream waits before sending a comment.
 *
 * A connection dropped without a FIN looks identical to a quiet one until
 * something is written, so the heartbeat is what makes a dead client
 * detectable — and what stops an intermediary from closing an idle stream.
 */
const HEARTBEAT_MS = 20_000;

/** How many events one poll forwards before leaving the rest for the next. */
const BATCH = 200;

/**
 * Concurrent streams allowed.
 *
 * The interface opens one. This ceiling is for the case where something local
 * opens them in a loop: each stream holds a timer and a socket, so an unbounded
 * count is an unbounded cost.
 */
export const MAX_SUBSCRIBERS = 16;

/**
 * Bytes allowed to queue for one client before it is disconnected.
 *
 * A reader that never drains would otherwise grow this process's memory without
 * limit. Dropping the connection is the honest failure: the client reconnects
 * with Last-Event-ID and misses nothing, because the log is the durable copy
 * and the stream is only a delivery mechanism.
 */
const MAX_BUFFERED_BYTES = 1024 * 1024;

function formatEvent(event: CtxdEvent): string {
  const payload = JSON.stringify({
    id: event.id,
    type: event.type,
    timestamp: event.createdAt,
    projectId: event.projectId,
    sessionId: event.sessionId,
    taskId: event.taskId,
    // Self-declared by the producer and never verified (§6). The field name
    // says claimed so a consumer cannot read it as an identity ctxd vouches for.
    claimedWorker: event.worker,
    data: event.data,
  });

  // `id:` is what the browser echoes back as Last-Event-ID on reconnect.
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${payload}\n\n`;
}

/**
 * Where a subscriber starts.
 *
 * A reconnecting browser sends Last-Event-ID automatically and it wins, because
 * it reflects what that client actually received — the `?after=` in its URL is
 * whatever the page happened to open with and is already stale by then.
 *
 * With neither, the stream starts at the present. A client that wants history
 * asks `/api/events/recent`, so a fresh subscriber never triggers a replay of
 * the entire log.
 */
function startCursor(
  context: RouteContext,
  request: RouteRequest,
  projectId: string,
  lastEventId: string | undefined,
): number {
  const fromHeader = Number.parseInt(lastEventId ?? "", 10);
  if (Number.isInteger(fromHeader) && fromHeader >= 0) return fromHeader;

  const after = request.query.get("after");
  if (after !== null && after !== "") {
    const parsed = Number.parseInt(after, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new HttpError(400, '"after" must be a non-negative integer event id');
    }
    return parsed;
  }

  return latestEventId(context.db, projectId);
}

export function createEventRoutes(context: RouteContext): Route[] {
  let subscribers = 0;

  return [
    {
      method: "GET",
      path: "/api/events",
      // A read, so no token — the same rule the other read routes follow. Note
      // that this means any loopback process can watch activity, exactly as it
      // can already read /api/tasks. Payloads carry identifiers only.
      mutating: false,
      handler: () => {
        throw new HttpError(500, "the event stream is served by the stream handler");
      },
      stream: (request, response): StreamSubscription => {
        const projectId = projectIdFor(context, request);

        if (subscribers >= MAX_SUBSCRIBERS) {
          throw new HttpError(
            503,
            `too many open event streams (limit ${MAX_SUBSCRIBERS}) — close one and retry`,
          );
        }

        const lastEventHeader = request.headers?.["last-event-id"];
        let cursor = startCursor(
          context,
          request,
          projectId,
          typeof lastEventHeader === "string" ? lastEventHeader : undefined,
        );

        subscribers += 1;
        let closed = false;

        response.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          connection: "keep-alive",
        });

        // Tells the browser how long to wait before reconnecting, and proves
        // the stream is open before the first event arrives.
        response.write(`retry: 2000\n: connected at event ${cursor}\n\n`);

        const finish = (): void => {
          if (closed) return;
          closed = true;
          subscribers -= 1;
          clearInterval(poll);
          clearInterval(heartbeat);
          response.end();
        };

        const send = (chunk: string): boolean => {
          if (closed || response.writableEnded) return false;
          response.write(chunk);
          if (response.writableLength > MAX_BUFFERED_BYTES) {
            // The client is not draining. Its place in the log is its own
            // Last-Event-ID, so disconnecting loses it nothing.
            finish();
            return false;
          }
          return true;
        };

        const poll = setInterval(() => {
          if (closed) return;
          let events: CtxdEvent[];
          try {
            events = readEvents(context.db, projectId, { after: cursor, limit: BATCH });
          } catch {
            // A read failure here is transient — the database may be mid-write
            // by another process. The next tick retries from the same cursor.
            return;
          }

          for (const event of events) {
            if (!send(formatEvent(event))) return;
            cursor = event.id;
          }
        }, POLL_MS);

        const heartbeat = setInterval(() => {
          send(": heartbeat\n\n");
        }, HEARTBEAT_MS);

        // Timers must not hold the process open on their own: `ctxd ui` has to
        // be able to exit, and a stream nobody is reading should never be the
        // reason it cannot.
        poll.unref();
        heartbeat.unref();

        response.on("close", finish);
        response.on("error", finish);

        return { close: finish };
      },
    },

    {
      // What the activity panel loads before the stream takes over. Separate
      // from the stream so a new subscriber never replays the whole log.
      method: "GET",
      path: "/api/events/recent",
      mutating: false,
      handler: (request) => {
        const projectId = projectIdFor(context, request);
        const limit = Number.parseInt(request.query.get("limit") ?? "50", 10);
        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 50;

        const events = recentEvents(context.db, projectId, safeLimit);
        return {
          events: events.map((event) => ({
            id: event.id,
            type: event.type,
            timestamp: event.createdAt,
            projectId: event.projectId,
            sessionId: event.sessionId,
            taskId: event.taskId,
            claimedWorker: event.worker,
            data: event.data,
          })),
          // Where a stream should start to continue exactly from this listing.
          latestId: latestEventId(context.db, projectId),
        };
      },
    },
  ];
}
