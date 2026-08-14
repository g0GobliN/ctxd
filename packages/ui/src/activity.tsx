/**
 * The live activity panel (§20).
 *
 * Every line here is an event the core actually recorded. Nothing is inferred
 * from the absence of an event, and nothing is displayed that a producer did
 * not write — an activity stream that invents a plausible line is worse than
 * an empty one, because it cannot be told apart from a real one.
 */

import { useEffect, useState, type ReactNode } from "react";
import { api, subscribeToEvents, type CtxdEvent } from "./api.js";
import { detailFor, labelFor, mergeEvents, toneFor } from "./activity-format.js";
import { formatTime, Panel, useApi } from "./common.js";

/** How many events the panel keeps before dropping the oldest. */
const WINDOW = 200;

export function ActivityStream(): ReactNode {
  const initial = useApi(() => api.recentEvents(WINDOW));
  const [live, setLive] = useState<CtxdEvent[]>([]);
  const [connected, setConnected] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    return subscribeToEvents(
      (event) => setLive((current) => [event, ...current].slice(0, WINDOW)),
      setConnected,
    );
  }, []);

  // The stream starts at the present, so history comes from the initial load.
  const events = mergeEvents(live, initial.data?.events ?? [], WINDOW);

  return (
    <>
      <h1>Activity</h1>
      <p className="subtitle">
        {connected === true
          ? "Live — streaming from the local event log"
          : connected === false
            ? "Reconnecting — events are still being recorded and will replay"
            : "Connecting…"}
      </p>

      <Panel
        loading={initial.loading}
        error={initial.error}
        empty={events.length === 0}
        emptyMessage="No activity recorded yet. Events appear when a worker connects or ctxd builds context."
      >
        <ul className="activity">
          {events.map((event) => (
            <li key={event.id} className={toneFor(event.type)}>
              <span className="activity-time">{formatTime(event.timestamp)}</span>
              <span className="activity-label">{labelFor(event.type)}</span>
              {event.claimedWorker !== null && (
                // "claims" is the whole point: the transport shows a client
                // attached, never which one, so the interface must not launder
                // a self-declared name into a verified identity (§6).
                <span className="activity-worker" title="Self-declared by the worker; ctxd cannot verify it">
                  claims {event.claimedWorker}
                </span>
              )}
              {detailFor(event) !== undefined && (
                <span className="activity-detail">{detailFor(event)}</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
