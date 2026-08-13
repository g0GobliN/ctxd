/**
 * The interface panels (§68–71).
 *
 * The interface is a viewer, not a second brain: it renders what the core
 * services already decided and never recomputes a verdict of its own. Anything
 * shown here can be obtained from the CLI, and it agrees with the CLI because
 * both read the same receipts.
 */

import { useState, type ReactNode } from "react";
import { api, type ChangeReceipt, type ContextReceipt } from "./api.js";
import { formatTime, Panel, Stat, useApi, verdictTone } from "./common.js";

/* Dashboard ---------------------------------------------------------------- */

export function Dashboard(): ReactNode {
  const status = useApi(() => api.status());
  const changes = useApi(() => api.changeReceipts());
  const contexts = useApi(() => api.contextReceipts());

  const contextReceipts = contexts.data?.receipts ?? [];
  const avoided = contextReceipts.reduce(
    (total, receipt) => total + (receipt.candidate_total_tokens - receipt.final_total_tokens),
    0,
  );

  return (
    <>
      <h1>Dashboard</h1>
      <p className="subtitle">{status.data?.dir ?? "…"}</p>

      <Panel loading={status.loading} error={status.error}>
        <div className="grid">
          <Stat label="Version" value={status.data?.version ?? "—"} />
          <Stat label="Mode" value={status.data?.mode ?? "—"} />
          <Stat label="Projects" value={status.data?.projects ?? 0} />
          <Stat
            label="Context builds"
            value={contextReceipts.length}
            note="receipts on disk"
          />
          <Stat
            label="Context avoided"
            value={avoided}
            // §18/§49: never a dollar figure, always labelled an estimate.
            note="estimated tokens, all receipts"
          />
          <Stat label="Changes reviewed" value={changes.data?.receipts.length ?? 0} />
        </div>

        <h2>Git</h2>
        <div className="card">{status.data?.git ?? "unknown"}</div>

        <h2>Storage</h2>
        <div className="card path">{status.data?.dataDir}</div>
        <p className="disclaimer">
          Everything ctxd knows lives here, on this machine. Nothing is sent anywhere.
        </p>
      </Panel>
    </>
  );
}

/* Context inspector (§68) --------------------------------------------------- */

export function ContextInspector(): ReactNode {
  const { data, error, loading } = useApi(() => api.contextReceipts());
  const [selected, setSelected] = useState(0);

  const receipts = data?.receipts ?? [];
  const receipt: ContextReceipt | undefined = receipts[selected];

  return (
    <>
      <h1>Context inspector</h1>
      <p className="subtitle">Why every token was sent — and why the rest was not.</p>

      <Panel
        loading={loading}
        error={error}
        empty={receipts.length === 0}
        emptyMessage="No context receipts yet. Run: ctxd context --task …"
      >
        {receipts.length > 1 && (
          <div className="toolbar">
            <select
              className="button"
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
            >
              {receipts.map((entry, index) => (
                <option key={entry.request_id} value={index}>
                  {formatTime(entry.timestamp)} — {entry.task.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
        )}

        {receipt !== undefined && <ContextReceiptView receipt={receipt} />}
      </Panel>
    </>
  );
}

function ContextReceiptView(props: { receipt: ContextReceipt }): ReactNode {
  const { receipt } = props;
  const avoided = receipt.candidate_total_tokens - receipt.final_total_tokens;
  const kept =
    receipt.candidate_total_tokens === 0
      ? 0
      : (receipt.final_total_tokens / receipt.candidate_total_tokens) * 100;

  return (
    <>
      <div className="card">
        <strong>{receipt.task}</strong>
        <div className="reason">
          {formatTime(receipt.timestamp)} · {receipt.project} · budget{" "}
          {receipt.budget.toLocaleString()}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Stat label="Candidate" value={receipt.candidate_total_tokens} note="estimated tokens" />
        <Stat label="Final" value={receipt.final_total_tokens} note="estimated tokens" />
        <Stat label="Avoided" value={avoided} note="estimated context avoided" />
      </div>

      <div className="bar" title={`${kept.toFixed(1)}% of candidate context sent`}>
        <div style={{ width: `${Math.min(100, kept)}%` }} />
      </div>
      <p className="disclaimer">
        {kept.toFixed(1)}% of the candidate context was sent. Counts are{" "}
        {receipt.token_count_estimation}, never exact provider billing units.
      </p>

      <h2>Removed</h2>
      <div className="grid">
        <Stat label="Duplicate" value={receipt.removed_tokens.duplicate_tokens} />
        <Stat label="Irrelevant" value={receipt.removed_tokens.irrelevant_tokens} />
        <Stat label="Low priority" value={receipt.removed_tokens.low_priority_tokens} />
        <Stat label="Compressed" value={receipt.removed_tokens.compressed_tokens} />
      </div>

      {receipt.warnings.length > 0 && (
        <>
          <h2>Warnings</h2>
          <div className="error">
            {receipt.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </>
      )}

      <h2>Included ({receipt.included_items.length})</h2>
      <div className="rows">
        {receipt.included_items.map((item) => (
          <div className="row included" key={`in-${item.path}`}>
            <div className="row-head">
              <span className="path">{item.path}</span>
              <span className="tag">
                {item.priority} · {item.token_count.toLocaleString()}
                {item.compressed === true ? " · compressed" : ""}
              </span>
            </div>
            <div className="reason">{item.reason}</div>
          </div>
        ))}
      </div>

      <h2>Excluded ({receipt.excluded_items.length})</h2>
      <div className="rows">
        {receipt.excluded_items.slice(0, 60).map((item) => (
          <div className="row excluded" key={`ex-${item.path}`}>
            <div className="row-head">
              <span className="path">{item.path}</span>
              <span className="tag">{item.priority}</span>
            </div>
            <div className="reason">{item.reason}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* Change inspector (§71) ---------------------------------------------------- */

export function ChangeInspector(): ReactNode {
  const [task, setTask] = useState("");
  const [applied, setApplied] = useState("");
  const live = useApi(() => api.diff(applied), [applied]);
  const saved = useApi(() => api.changeReceipts());

  return (
    <>
      <h1>Change inspector</h1>
      <p className="subtitle">
        What the worker actually changed. ctxd reports; it never reverts.
      </p>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Describe the task to judge the change against…"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setApplied(task);
          }}
        />
        <button className="button" onClick={() => setApplied(task)}>
          Analyse
        </button>
      </div>

      <Panel loading={live.loading} error={live.error}>
        {live.data !== undefined && <ChangeReceiptView receipt={live.data} />}
      </Panel>

      <h2>Saved receipts</h2>
      <Panel
        loading={saved.loading}
        error={saved.error}
        empty={(saved.data?.receipts.length ?? 0) === 0}
        emptyMessage="No change receipts yet. Run: ctxd diff --task …"
      >
        <div className="rows">
          {(saved.data?.receipts ?? []).map((receipt) => (
            <div className="row" key={receipt.request_id}>
              <div className="row-head">
                <span>{receipt.task}</span>
                <span className={`tag ${verdictTone(receipt.classification)}`}>
                  {receipt.classification}
                </span>
              </div>
              <div className="reason">
                {formatTime(receipt.timestamp)} · {receipt.files_changed} file(s) · +
                {receipt.lines_added}/−{receipt.lines_removed} · efficiency{" "}
                {receipt.change_efficiency_score.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function ChangeReceiptView(props: { receipt: ChangeReceipt }): ReactNode {
  const { receipt } = props;

  if (receipt.files_changed === 0) {
    return <div className="empty">No uncommitted changes in this repository.</div>;
  }

  return (
    <>
      <div className="card">
        <div className="row-head">
          <strong>{receipt.classification}</strong>
          <span className={`tag ${verdictTone(receipt.classification)}`}>
            risk: {receipt.risk}
          </span>
        </div>
        <div className="reason">{receipt.recommendation}</div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Stat label="Files" value={receipt.files_changed} />
        <Stat label="Added" value={receipt.lines_added} note="lines" />
        <Stat label="Removed" value={receipt.lines_removed} note="lines" />
        <Stat label="Semantic" value={receipt.semantic_lines} note="observable lines" />
        <Stat
          label="Formatting"
          value={receipt.formatting_lines}
          note="presentation only"
        />
        <Stat
          label="Efficiency"
          value={receipt.change_efficiency_score.toFixed(2)}
          note="focus, not correctness"
        />
      </div>

      <h2>Why</h2>
      <div className="rows">
        {receipt.classification_reasons.map((reason) => (
          <div className="row" key={reason}>
            {reason}
          </div>
        ))}
      </div>

      {receipt.signals.length > 0 && (
        <>
          <h2>Signals</h2>
          <div className="rows">
            {receipt.signals.map((signal) => (
              <div
                className={`row ${signal.severity === "warning" ? "unrelated" : ""}`}
                key={signal.id}
              >
                <div className="row-head">
                  <span>{signal.summary}</span>
                  <span className={`tag ${signal.severity === "warning" ? "warn" : ""}`}>
                    {signal.severity}
                  </span>
                </div>
                {signal.evidence !== "" && <div className="reason">{signal.evidence}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Files</h2>
      <div className="rows">
        {receipt.files.map((file) => (
          <div className={`row ${file.related ? "" : "unrelated"}`} key={file.path}>
            <div className="row-head">
              <span className="path">{file.path}</span>
              <span className={`tag ${file.related ? "" : "warn"}`}>
                +{file.lines_added}/−{file.lines_removed}
              </span>
            </div>
            <div className="reason">
              {file.semantic_lines} semantic, {file.formatting_lines} presentation — {file.reason}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* Memory (§67) -------------------------------------------------------------- */

export function MemoryViewer(): ReactNode {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const { data, error, loading } = useApi(() => api.memories(applied), [applied]);

  const memories = data?.hits ?? data?.memories ?? [];

  return (
    <>
      <h1>Memory</h1>
      <p className="subtitle">What a future session could not infer from the code.</p>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search project memory…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setApplied(query);
          }}
        />
        <button className="button" onClick={() => setApplied(query)}>
          Search
        </button>
      </div>

      <Panel
        loading={loading}
        error={error}
        empty={memories.length === 0}
        emptyMessage="No memories recorded yet. Run: ctxd memory add …"
      >
        <div className="rows">
          {memories.map((memory) => (
            <div className="row" key={memory.id}>
              <div className="row-head">
                <strong>{memory.title}</strong>
                <span className="tag">{memory.type}</span>
              </div>
              <div className="reason">
                {/* Source and confidence are shown because authority depends on
                    them (§31): an inferred memory must never read like a rule. */}
                {memory.source} · confidence {memory.confidence} · importance {memory.importance}
              </div>
              <pre>{memory.content}</pre>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

/* Tasks (§67) --------------------------------------------------------------- */

const COLUMNS = ["BACKLOG", "PLANNED", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"] as const;

export function TaskBoard(): ReactNode {
  const { data, error, loading } = useApi(() => api.tasks());
  const tasks = data?.tasks ?? [];

  return (
    <>
      <h1>Tasks</h1>
      <p className="subtitle">Units of work ctxd is tracking.</p>

      <Panel
        loading={loading}
        error={error}
        empty={tasks.length === 0}
        emptyMessage="No tasks yet. Run: ctxd task add …"
      >
        <div className="kanban">
          {COLUMNS.map((column) => {
            const inColumn = tasks.filter((task) => task.status === column);
            if (inColumn.length === 0) return null;
            return (
              <div key={column}>
                <h3>
                  {column.replace("_", " ")} ({inColumn.length})
                </h3>
                <div className="rows">
                  {inColumn.map((task) => (
                    <div className="row" key={task.id}>
                      <div>{task.title}</div>
                      <div className="reason">
                        P{task.priority}
                        {task.worker != null ? ` · ${task.worker}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

/* Resume -------------------------------------------------------------------- */

export function Resume(): ReactNode {
  const { data, error, loading } = useApi(() => api.resume());

  return (
    <>
      <h1>Resume</h1>
      <p className="subtitle">What was I doing?</p>

      <Panel loading={loading} error={error}>
        <pre>{data?.resume}</pre>
      </Panel>
    </>
  );
}

/* Worker monitor (§69) ------------------------------------------------------ */

export function WorkerMonitor(): ReactNode {
  const { data, error, loading } = useApi(() => api.workers());
  const workers = data?.workers ?? [];

  return (
    <>
      <h1>Workers</h1>
      <p className="subtitle">
        Who has been working on this project. Workers are replaceable; the memory is not.
      </p>

      <Panel loading={loading} error={error}>
        <div className="rows">
          {workers.map((worker) => (
            <div className="row" key={worker.id}>
              <div className="row-head">
                <strong>{worker.name}</strong>
                <span className={`tag ${worker.state === "active" ? "ok" : ""}`}>
                  {worker.state}
                </span>
              </div>
              <div className="reason">
                {/* An unknown status is shown as unknown. Claiming a worker is
                    idle when ctxd recorded nothing would be a guess. */}
                {worker.source === "unknown"
                  ? "no recorded activity — ctxd has not seen this worker on this project"
                  : `last activity ${formatTime(worker.lastActivity ?? "")}`}
              </div>
              {worker.currentTask !== null && (
                <div className="reason">current task: {worker.currentTask}</div>
              )}
              {worker.currentTask === null && worker.lastTask !== null && (
                <div className="reason">last task: {worker.lastTask}</div>
              )}
              {worker.lastSummary !== null && <pre>{worker.lastSummary}</pre>}
              {worker.capabilities.length > 0 && (
                <div className="reason">capabilities: {worker.capabilities.join(", ")}</div>
              )}
            </div>
          ))}
        </div>
        <p className="disclaimer">
          ctxd knows these names but nothing about how any of them work. No provider SDK is
          involved, and a worker it has never heard of appears here just the same.
        </p>
      </Panel>
    </>
  );
}

/* Settings (§67) ------------------------------------------------------------ */

export function SettingsView(): ReactNode {
  const { data, error, loading } = useApi(() => api.settings());

  return (
    <>
      <h1>Settings</h1>
      <p className="subtitle">Read-only. The configuration file is the interface.</p>

      <Panel loading={loading} error={error}>
        <h2>Configuration file</h2>
        <div className="card path">{data?.configFile}</div>
        <p className="disclaimer">{data?.note}</p>

        <h2>Storage</h2>
        <div className="card path">{data?.dataDir}</div>

        <h2>Current values</h2>
        <pre>{JSON.stringify(data?.config ?? {}, null, 2)}</pre>
      </Panel>
    </>
  );
}
