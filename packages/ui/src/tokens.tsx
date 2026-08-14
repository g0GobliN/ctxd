/**
 * The token monitor (UI-7, §48, §49).
 *
 * Every figure comes from `/api/stats`, which is `@ctxd/stats` — the same
 * module behind `ctxd stats`. The interface adds no arithmetic of its own, so
 * the panel and the command cannot disagree about the same receipts. That was
 * the point of retiring the browser-side sum the dashboard used to do: a number
 * computed in two places is a number that will eventually differ in two places.
 *
 * There is no cost figure here and there never will be. ctxd has no billing
 * data, the counts are a heuristic estimate, and "estimated context avoided" is
 * the strongest claim the evidence supports.
 */

import { useState, type ReactNode } from "react";
import { api, type StatsWindow } from "./api.js";
import { formatTime, Panel, Stat, useApi } from "./common.js";

const WINDOWS: readonly { id: StatsWindow; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

export function TokenMonitor(): ReactNode {
  const [window, setWindow] = useState<StatsWindow>("7d");
  const { data, error, loading } = useApi(() => api.stats(window), [window]);

  const context = data?.context;
  const change = data?.change;

  const sent =
    context === undefined || context.candidateTokens === 0
      ? undefined
      : (context.finalTokens / context.candidateTokens) * 100;

  return (
    <>
      <h1>Tokens</h1>
      <p className="subtitle">
        What the context firewall kept out of the model — counted from receipts on disk.
      </p>

      <div className="toolbar" role="group" aria-label="Reporting window">
        {WINDOWS.map((entry) => (
          <button
            key={entry.id}
            className="button"
            aria-pressed={entry.id === window}
            onClick={() => setWindow(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <Panel
        loading={loading}
        error={error}
        empty={context !== undefined && context.requests === 0}
        emptyMessage="No context receipts in this window. Run: ctxd context --task …"
      >
        {data !== undefined && context !== undefined && change !== undefined && (
          <>
            <p className="disclaimer">
              {data.scope}
              {data.since === null
                ? " — every receipt on disk"
                : ` — receipts at or after ${formatTime(data.since)}`}
            </p>

            <div className="grid">
              <Stat label="Requests" value={context.requests} note="context builds" />
              <Stat
                label="Candidate"
                value={context.candidateTokens}
                note={`${context.accuracy} tokens`}
              />
              <Stat
                label="Final"
                value={context.finalTokens}
                note={`${context.accuracy} tokens`}
              />
              <Stat
                label="Avoided"
                value={context.avoidedTokens}
                // The one phrase §48 permits. Never a currency figure.
                note="estimated context avoided"
              />
            </div>

            {sent !== undefined && (
              <>
                <div className="bar" title={`${sent.toFixed(1)}% of candidate context sent`}>
                  <div style={{ width: `${Math.min(100, sent)}%` }} />
                </div>
                <p className="disclaimer">
                  {sent.toFixed(1)}% of candidate context was sent. Counts are{" "}
                  {context.accuracy}, from a local heuristic tokenizer — not provider billing
                  units. ctxd has no billing data and never reports a cost.
                </p>
              </>
            )}

            <h2>Where the tokens went</h2>
            <div className="grid">
              <Stat label="Duplicate" value={context.duplicateTokens} />
              <Stat label="Irrelevant" value={context.irrelevantTokens} />
              <Stat label="Low priority" value={context.lowPriorityTokens} />
              <Stat label="Compressed" value={context.compressedTokens} />
            </div>

            <h2>Changes reviewed</h2>
            {change.reviews === 0 ? (
              <div className="empty">
                No change receipts in this window. Run: ctxd diff --task …
              </div>
            ) : (
              <>
                <div className="grid">
                  <Stat label="Reviews" value={change.reviews} />
                  <Stat label="Files" value={change.filesChanged} />
                  <Stat label="Semantic" value={change.semanticLines} note="observable lines" />
                  <Stat
                    label="Presentation"
                    value={change.formattingLines}
                    note="formatting only"
                  />
                  <Stat
                    label="Efficiency"
                    // Absent rather than zero when no review has been scored:
                    // 0.00 would read as "every change was unfocused" (§37).
                    value={
                      change.meanEfficiency === undefined
                        ? "unknown"
                        : change.meanEfficiency.toFixed(2)
                    }
                    note="focus, not correctness"
                  />
                </div>

                <div className="rows" style={{ marginTop: 12 }}>
                  {Object.entries(change.byClassification).map(([verdict, count]) => (
                    <div className="row" key={verdict}>
                      <div className="row-head">
                        <span>{verdict}</span>
                        <span className="tag">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {context.firstAt !== undefined && (
              <p className="disclaimer">
                Receipts from {formatTime(context.firstAt)} to{" "}
                {formatTime(context.lastAt ?? context.firstAt)}.
              </p>
            )}

            {data.unreadable.length > 0 && (
              <>
                <h2>Not counted</h2>
                <div className="error">
                  {/* A receipt that could not be read is missing from the
                      totals above. Saying so is the difference between a
                      number that is incomplete and one that is wrong. */}
                  {data.unreadable.length} receipt file(s) could not be read, so they are
                  missing from these totals:
                  {data.unreadable.map((path) => (
                    <div className="path" key={path}>
                      {path}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
