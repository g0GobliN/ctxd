/**
 * The interface panels (§68–71).
 *
 * The interface never decides anything: it renders what the core services
 * already decided and never recomputes a verdict of its own. Anything shown
 * here can be obtained from the CLI, and it agrees with the CLI because both
 * read the same receipts.
 *
 * Since 2.1 the panels can also write, through routes that call the same core
 * functions the CLI calls (see api.md). A write never interprets its own
 * result: a refusal is shown with the reason the core gave, not softened or
 * retried.
 */

import { useState, type ReactNode } from "react";
import {
  api,
  selectedProject,
  selectProject,
  storedToken,
  storeToken,
  type AgentRun,
  type ChangeReceipt,
  type ContextReceipt,
  type VerificationResult,
  type WorkerConnection,
} from "./api.js";
import { formatTime, Panel, Stat, useApi, verdictTone } from "./common.js";

/* Writing ------------------------------------------------------------------- */

/**
 * The outcome of a write, shown verbatim.
 *
 * Refusals matter more than successes here. `saveMemory` can decline a write
 * whose authority is too low to override what is recorded, and that answer is
 * the product working correctly — so it is rendered as a stated reason rather
 * than as a failure the developer should retry past.
 */
function WriteResult(props: { message: string; tone: "ok" | "refused" }): ReactNode {
  return (
    <p className={props.tone === "ok" ? "reason" : "warning"} role="status">
      {props.message}
    </p>
  );
}

/** Turn a thrown ApiError into something worth reading. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "the write failed";
}

/* Dashboard ---------------------------------------------------------------- */

export function Dashboard(): ReactNode {
  const status = useApi(() => api.status());
  // The totals come from `/api/stats`, which is `@ctxd/stats` — the same code
  // `ctxd stats` runs. This panel used to sum the receipt listing itself, which
  // made the browser a second place the figure was computed and so a second
  // place it could be wrong; worse, the listing is capped, so the total quietly
  // stopped being a total once a project outgrew the cap (UI-7).
  const stats = useApi(() => api.stats("all"));

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
            value={stats.data?.context.requests ?? "…"}
            note="receipts on disk"
          />
          <Stat
            label="Context avoided"
            value={stats.data?.context.avoidedTokens ?? "…"}
            // §18/§49: never a dollar figure, always labelled an estimate.
            note={`${stats.data?.context.accuracy ?? "unknown"} tokens, all receipts`}
          />
          <Stat label="Changes reviewed" value={stats.data?.change.reviews ?? "…"} />
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
  const { data, error, loading, refresh } = useApi(() => api.contextReceipts());
  const [selected, setSelected] = useState(0);

  const [task, setTask] = useState("");
  const [budget, setBudget] = useState("10000");
  const [building, setBuilding] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  const receipts = data?.receipts ?? [];
  const receipt: ContextReceipt | undefined = receipts[selected];

  /**
   * Build context for a task, then show its receipt.
   *
   * The new receipt is the newest, and the listing is newest-first, so the
   * selection resets to the top rather than leaving the panel showing the
   * previous build while claiming to have run a new one.
   */
  const build = async (): Promise<void> => {
    setBuilding(true);
    setFailure(undefined);
    try {
      const parsed = Number.parseInt(budget, 10);
      await api.buildContext({
        task,
        budget: Number.isInteger(parsed) && parsed > 0 ? parsed : 10000,
      });
      setSelected(0);
      refresh();
    } catch (problem) {
      setFailure(describeError(problem));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      <h1>Context inspector</h1>
      <p className="subtitle">Why every token was sent — and why the rest was not.</p>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Task — what are you about to work on?"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && task.trim() !== "") void build();
          }}
        />
        <input
          type="number"
          min={1}
          step={1000}
          aria-label="Token budget"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
        />
        <button
          className="button"
          disabled={building || task.trim() === ""}
          onClick={() => void build()}
        >
          {building ? "Building…" : "Build context"}
        </button>
      </div>
      {failure !== undefined ? <WriteResult message={failure} tone="refused" /> : null}

      <Panel
        loading={loading}
        error={error}
        empty={receipts.length === 0}
        emptyMessage="No context receipts yet. Build one above, or run: ctxd context --task …"
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
          {receipt.budget.toLocaleString()} ·{" "}
          {/* Receipts written before requesters were recorded have no worker at
              all, and so read unknown rather than being attributed to a guess. */}
          {receipt.claimed_worker === undefined
            ? "requester unknown"
            : `claims ${receipt.claimed_worker}`}
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
          {(saved.data?.receipts ?? []).map((receipt) => {
            const warnings = receipt.signals.filter(
              (signal) => signal.severity === "warning",
            );
            return (
              <div className="row" key={receipt.request_id}>
                <div className="row-head">
                  <span>{receipt.task}</span>
                  <span className={`tag ${verdictTone(receipt.classification)}`}>
                    {receipt.classification}
                  </span>
                  <span className={`tag ${receipt.risk === "high" ? "danger" : ""}`}>
                    risk: {receipt.risk}
                  </span>
                </div>
                <div className="reason">
                  {formatTime(receipt.timestamp)} · {receipt.files_changed} file(s) · +
                  {receipt.lines_added}/−{receipt.lines_removed} · efficiency{" "}
                  {receipt.change_efficiency_score.toFixed(2)} · verification{" "}
                  {receipt.verification_status}
                </div>
                {/* The warning is the point of the receipt, so it belongs in the
                    listing rather than one click away. A summary that showed only
                    a verdict would make a developer open every row to find the
                    one that mattered. */}
                {warnings.map((signal) => (
                  <div className="reason warn" key={signal.id}>
                    ⚠ {signal.summary}
                    {signal.evidence === "" ? "" : ` — ${signal.evidence}`}
                  </div>
                ))}
              </div>
            );
          })}
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

      <ExpectedScope receipt={receipt} />
      <NoiseBreakdown receipt={receipt} />

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

      <CommentNoise receipt={receipt} />

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

      <p className="disclaimer">
        ctxd reports and never reverts. Nothing here is applied to the working tree, no
        worker output is rewritten, and a large diff is never treated as proof of a wrong
        one (§50). Analysis version {receipt.algorithm_version}.
      </p>
    </>
  );
}

/**
 * The expectation the diff was judged against (§51, §55).
 *
 * Showing the expectation next to the actual is what makes a mismatch warning
 * arguable. Without it the verdict is an opinion the developer can only accept
 * or ignore; with it they can see that ctxd expected a one-file change, decide
 * the task was bigger than it read, and move on.
 */
function ExpectedScope(props: { receipt: ChangeReceipt }): ReactNode {
  const { receipt } = props;
  if (receipt.expected_size === "unknown") {
    return (
      <>
        <h2>Expected scope</h2>
        <div className="card">
          <div className="reason">
            No expectation was formed — the task text did not imply a size, so the diff was
            judged on its own shape rather than against a target.
          </div>
        </div>
      </>
    );
  }

  const overFiles =
    receipt.expected_files !== null && receipt.files_changed > receipt.expected_files;
  const overLines =
    receipt.expected_lines !== null && receipt.semantic_lines > receipt.expected_lines;

  return (
    <>
      <h2>Expected scope</h2>
      <div className="card">
        <div className="row-head">
          <strong>{receipt.expected_size} task</strong>
          <span className={`tag ${overFiles || overLines ? "warn" : "ok"}`}>
            {overFiles || overLines ? "over expectation" : "within expectation"}
          </span>
        </div>
        <div className="reason">
          expected about {receipt.expected_files ?? "—"} file(s) and{" "}
          {receipt.expected_lines ?? "—"} semantic line(s); got {receipt.files_changed}{" "}
          file(s) and {receipt.semantic_lines}
        </div>
        <div className="reason">
          {/* §51 is explicit that this warns rather than rejects — the
              expectation decides whether a diff is worth a second look, never
              whether it is correct. */}
          The expectation is inferred from the task text and is deliberately coarse. It
          decides whether a change is worth a second look, never whether it is right.
        </div>
      </div>
    </>
  );
}

/**
 * Presentation-only churn, separated from semantic change (§53).
 *
 * Reported and never acted on. ctxd detects formatting noise precisely so a
 * reviewer can skip past it, not so anything can be reverted — destroying
 * worker output to tidy a diff would be a worse problem than the one it solves.
 */
function NoiseBreakdown(props: { receipt: ChangeReceipt }): ReactNode {
  const { receipt } = props;

  const counts: readonly { label: string; value: number; note: string }[] = [
    {
      label: "Formatting only",
      value: receipt.formatting_only_changes,
      note: "files with no semantic change",
    },
    { label: "Comment only", value: receipt.comment_only_changes, note: "files" },
    { label: "Import only", value: receipt.import_only_changes, note: "files" },
    { label: "Whole-file rewrites", value: receipt.whole_file_rewrites, note: "files" },
    { label: "Renames", value: receipt.rename_changes, note: "files" },
    { label: "Generated", value: receipt.generated_file_changes, note: "files" },
    { label: "Dependencies", value: receipt.dependency_changes, note: "manifest changes" },
    { label: "Unrelated", value: receipt.unrelated_files.length, note: "files" },
  ];

  const present = counts.filter((entry) => entry.value > 0);
  if (present.length === 0) return null;

  return (
    <>
      <h2>Noise</h2>
      <div className="grid">
        {present.map((entry) => (
          <Stat key={entry.label} label={entry.label} value={entry.value} note={entry.note} />
        ))}
      </div>
      {receipt.unrelated_files.length > 0 && (
        <div className="rows" style={{ marginTop: 12 }}>
          {receipt.unrelated_files.map((path) => (
            <div className="row unrelated" key={path}>
              <span className="path">{path}</span>
            </div>
          ))}
        </div>
      )}
      <p className="disclaimer">
        Presentation-only change is separated from semantic change so a reviewer can skip
        it. ctxd never reverts it and never reformats worker output (§53).
      </p>
    </>
  );
}

/**
 * Comments that restate the syntax (§54).
 *
 * The wording matters here more than the list. ctxd never deletes a comment,
 * and the right response to a genuinely redundant one is usually not deletion
 * at all — durable reasoning belongs in ctxd memory, where the next session
 * will actually find it, rather than in a comment that the next worker will
 * "clean up".
 */
function CommentNoise(props: { receipt: ChangeReceipt }): ReactNode {
  const { receipt } = props;
  if (receipt.comments_flagged.length === 0) return null;

  return (
    <>
      <h2>Comments flagged ({receipt.comments_flagged.length})</h2>
      <div className="rows">
        {receipt.comments_flagged.map((comment) => (
          <div className="row" key={comment}>
            <pre>{comment}</pre>
          </div>
        ))}
      </div>
      <p className="disclaimer">
        These restate what the code already says. Comments explaining <em>why</em> — security
        constraints, business rules, API quirks, workarounds, non-obvious invariants — are
        never flagged. ctxd does not delete either kind; durable reasoning belongs in project
        memory, where the next session will find it.
      </p>
    </>
  );
}

/* Memory (§67) -------------------------------------------------------------- */

const MEMORY_TYPES = ["DECISION", "CONSTRAINT", "BUG", "RULE", "NOTE"] as const;

/**
 * Record a memory (`ctxd memory add`).
 *
 * `source` defaults to `accepted_decision` because the person typing here is
 * the developer, not a worker — the same default the CLI uses. See api.md for
 * why the interface is allowed sources the MCP surface refuses.
 */
function MemoryComposer(props: { onSaved: () => void }): ReactNode {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<string>("DECISION");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; tone: "ok" | "refused" } | undefined>();

  const submit = async (): Promise<void> => {
    setBusy(true);
    setResult(undefined);
    try {
      const saved = await api.saveMemory({ title, content, type });
      const message =
        saved.outcome === "superseded"
          ? `Recorded, superseding ${saved.supersedes ?? "the previous version"}.`
          : saved.outcome === "unchanged"
            ? "Already recorded; nothing changed."
            : "Recorded.";
      setResult({ message, tone: "ok" });
      setTitle("");
      setContent("");
      props.onSaved();
    } catch (error) {
      // A 409 is an authority refusal, which is the core doing its job.
      setResult({ message: describeError(error), tone: "refused" });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="toolbar">
        <button className="button" onClick={() => setOpen(true)}>
          Record a memory
        </button>
      </div>
    );
  }

  return (
    <div className="row">
      <div className="toolbar">
        <input
          type="text"
          placeholder="Title — what a future session needs to know"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {MEMORY_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <textarea
        rows={4}
        placeholder="Why — the reasoning the code cannot show"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="toolbar">
        <button
          className="button"
          disabled={busy || title.trim() === "" || content.trim() === ""}
          onClick={() => void submit()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {result !== undefined ? <WriteResult message={result.message} tone={result.tone} /> : null}
    </div>
  );
}

export function MemoryViewer(): ReactNode {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const { data, error, loading, refresh } = useApi(() => api.memories(applied), [applied]);

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

      <MemoryComposer onSaved={refresh} />

      <Panel
        loading={loading}
        error={error}
        empty={memories.length === 0}
        emptyMessage="No memories recorded yet. Record one above, or run: ctxd memory add …"
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

/* Projects ------------------------------------------------------------------ */

/**
 * Register a directory and list what is registered (`ctxd init`).
 *
 * This panel is what makes the window a starting point rather than a second
 * screen for something the terminal had to set up first: without it, a person
 * who prefers a GUI still had to open a shell before ctxd knew any project
 * existed.
 */
export function Projects(): ReactNode {
  const { data, error, loading, refresh } = useApi(() => api.projects());
  const projects = data?.projects ?? [];

  const [dir, setDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(selectedProject());
  const [result, setResult] = useState<{ message: string; tone: "ok" | "refused" } | undefined>();

  const register = async (): Promise<void> => {
    setBusy(true);
    setResult(undefined);
    try {
      const done = await api.registerProject({ dir });
      const counted =
        done.indexed === undefined ? "" : ` — ${done.indexed.total} files indexed`;
      setResult({
        message: `${done.outcome === "registered" ? "Registered" : "Refreshed"} ${done.project.name}${counted}.`,
        tone: "ok",
      });
      setDir("");
      refresh();
    } catch (problem) {
      setResult({ message: describeError(problem), tone: "refused" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Projects</h1>
      <p className="subtitle">
        What ctxd is tracking. Detection reads real manifest files — never
        directory names.
        {chosen === ""
          ? " Every panel follows the directory this window was opened on."
          : " Every panel is pinned to the project marked in view."}
      </p>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Absolute path to a project directory…"
          value={dir}
          onChange={(event) => setDir(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && dir.trim() !== "") void register();
          }}
        />
        <button className="button" disabled={busy || dir.trim() === ""} onClick={() => void register()}>
          {busy ? "Registering…" : "Register"}
        </button>
      </div>
      {result !== undefined ? <WriteResult message={result.message} tone={result.tone} /> : null}

      <Panel
        loading={loading}
        error={error}
        empty={projects.length === 0}
        emptyMessage="No projects registered yet. Add a directory above."
      >
        <div className="rows">
          {projects.map((project) => {
            const active = project.id === chosen;
            return (
              <div className="row" key={project.id}>
                <div className="row-head">
                  <strong>{project.name}</strong>
                  <span className="tag">{active ? "in view" : (project.language ?? "unknown")}</span>
                </div>
                <div className="path">{project.root}</div>
                <div className="reason">
                  {project.id}
                  {project.framework != null ? ` · ${project.framework}` : ""}
                  {project.package_manager != null ? ` · ${project.package_manager}` : ""}
                </div>
                <button
                  className="button"
                  onClick={() => {
                    // Reads and writes both follow this, so switching cannot
                    // leave the panels showing one project while a write lands
                    // in another.
                    selectProject(active ? "" : project.id);
                    setChosen(active ? "" : project.id);
                  }}
                >
                  {active ? "Stop pinning" : "View this project"}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

/* Agent --------------------------------------------------------------------- */

/**
 * Give a task to a worker and watch the whole loop.
 *
 * context → routing → worker → change review, each stage the same service the
 * CLI uses. The panel renders what happened; it decides nothing itself.
 *
 * **Edits are off by default.** §34 forbids over-automation, and a run that
 * rewrites a working tree unasked is precisely that. Turning it on is a
 * deliberate act, and even then nothing is committed or accepted — the run ends
 * with a Change Receipt a person still has to agree with.
 */
export function Agent(): ReactNode {
  const { data: runnerData } = useApi(() => api.agentRunners());
  const runners = runnerData?.runners ?? [];

  const [task, setTask] = useState("");
  const [applyEdits, setApplyEdits] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<AgentRun | undefined>();
  const [failure, setFailure] = useState<string | undefined>();

  const go = async (): Promise<void> => {
    setRunning(true);
    setFailure(undefined);
    setRun(undefined);
    try {
      setRun(await api.runAgent({ task, applyEdits }));
    } catch (problem) {
      setFailure(describeError(problem));
    } finally {
      setRunning(false);
    }
  };

  const receipt = run?.contextReceipt;
  const avoided =
    receipt === undefined
      ? 0
      : receipt.candidate_total_tokens - receipt.final_total_tokens;

  return (
    <>
      <h1>Agent</h1>
      <p className="subtitle">
        Give a task to a worker. ctxd selects the context, chooses who runs it,
        and inspects what comes back.
      </p>

      <div className="rows">
        {runners.map((runner) => (
          <div className="reason" key={runner.id}>
            {runner.available ? "▸" : "×"} <strong>{runner.name}</strong> — {runner.detail}
          </div>
        ))}
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="What should it do?"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && task.trim() !== "") void go();
          }}
        />
        <button className="button" disabled={running || task.trim() === ""} onClick={() => void go()}>
          {running ? "Running…" : "Run"}
        </button>
      </div>

      <label className="reason">
        <input
          type="checkbox"
          checked={applyEdits}
          onChange={(event) => setApplyEdits(event.target.checked)}
        />{" "}
        Let the worker edit files. Off by default — without it the worker reads
        and reports, and your working tree is untouched.
      </label>

      {failure !== undefined ? <WriteResult message={failure} tone="refused" /> : null}

      {run !== undefined ? (
        <>
          <h2>Routing</h2>
          <div className="card">
            <strong>
              {run.routing.worker} · {run.routing.model}
            </strong>
            {run.routing.reasons.map((reason) => (
              <div className="reason" key={reason}>
                · {reason}
              </div>
            ))}
          </div>

          <h2>Context sent</h2>
          <div className="card">
            <Stat
              label="estimated context avoided"
              value={avoided.toLocaleString()}
            />
            <div className="reason">
              {receipt?.candidate_total_tokens.toLocaleString()} candidate →{" "}
              {receipt?.final_total_tokens.toLocaleString()} sent — every item with a
              stated reason, in the Context panel
            </div>
          </div>

          <h2>What the worker did</h2>
          <div className="card">
            <strong className={run.worker.ok ? "ok" : "warning"}>
              {run.worker.ok ? "completed" : "failed"}
            </strong>
            <div className="reason">
              {(run.worker.durationMs / 1000).toFixed(1)}s
              {run.worker.turns !== undefined ? ` · ${run.worker.turns} turn(s)` : ""}
              {/* Labelled as the worker's own figure, and never as a bill:
                  on a subscription no money changes hands per run (§18). */}
              {run.worker.reportedCostUsd !== undefined
                ? ` · worker reports $${run.worker.reportedCostUsd.toFixed(4)} equivalent API cost`
                : ""}
            </div>
            {run.worker.error !== undefined ? (
              <pre>{run.worker.error}</pre>
            ) : (
              <pre>{run.worker.result}</pre>
            )}
          </div>

          {run.change !== undefined ? (
            <>
              <h2>What changed</h2>
              <ChangeReceiptView receipt={run.change} />
            </>
          ) : applyEdits ? (
            <p className="disclaimer">
              No change review: the working tree could not be read as a Git
              repository.
            </p>
          ) : (
            <p className="disclaimer">
              Edits were not enabled, so there is nothing of the worker's to
              review and your working tree was not touched.
            </p>
          )}
        </>
      ) : null}
    </>
  );
}

/* Verification (§21, §43) --------------------------------------------------- */

/**
 * Run the project's own checks (`ctxd verify`).
 *
 * The one panel that executes anything. What runs is discovered from the
 * project's manifest — its own typecheck, lint, test and build scripts — and
 * cannot be supplied by the request, so this is not a shell.
 *
 * A check that did not run is never drawn as a pass (§13): its status is shown
 * verbatim, including `skipped`.
 */
export function Verification(): ReactNode {
  const [result, setResult] = useState<VerificationResult | undefined>();
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  const run = async (dryRun: boolean): Promise<void> => {
    setRunning(true);
    setFailure(undefined);
    try {
      setResult(await api.verify({ dryRun }));
    } catch (problem) {
      setFailure(describeError(problem));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <h1>Verification</h1>
      <p className="subtitle">
        The project's own checks. ctxd runs what your manifest already defines —
        it never invents a command.
      </p>

      <div className="toolbar">
        <button className="button" disabled={running} onClick={() => void run(false)}>
          {running ? "Running…" : "Run checks"}
        </button>
        <button className="button" disabled={running} onClick={() => void run(true)}>
          Show what would run
        </button>
      </div>
      <p className="disclaimer">
        Checks run in this process, so the interface waits while they do — a full
        test run can take a while.
      </p>
      {failure !== undefined ? <WriteResult message={failure} tone="refused" /> : null}

      {result !== undefined ? (
        <>
          <div className="card">
            <strong className={verdictTone(result.status)}>{result.status}</strong>
            <div className="reason">
              {formatTime(result.timestamp)} · {result.changedFiles.length} changed file(s)
            </div>
          </div>

          {result.reasons.length > 0 ? (
            <div className="rows">
              {result.reasons.map((reason) => (
                <div className="reason" key={reason}>
                  · {reason}
                </div>
              ))}
            </div>
          ) : null}

          <div className="rows">
            {result.checks.map((check) => (
              <div className="row" key={`${check.kind}-${check.command}`}>
                <div className="row-head">
                  <strong>{check.kind}</strong>
                  <span className="tag">{check.status}</span>
                </div>
                <div className="path">{check.command}</div>
                <div className="reason">
                  {check.detail}
                  {check.durationMs > 0 ? ` · ${check.durationMs}ms` : ""}
                </div>
                {check.output !== undefined ? <pre>{check.output}</pre> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

/* Tasks (§67) --------------------------------------------------------------- */

const COLUMNS = ["BACKLOG", "PLANNED", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"] as const;

export function TaskBoard(): ReactNode {
  const { data, error, loading, refresh } = useApi(() => api.tasks());
  const tasks = data?.tasks ?? [];

  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  const create = async (): Promise<void> => {
    setBusy(true);
    setFailure(undefined);
    try {
      await api.createTask({ title });
      setTitle("");
      refresh();
    } catch (problem) {
      setFailure(describeError(problem));
    } finally {
      setBusy(false);
    }
  };

  // Moving a card is a PATCH carrying only `status`; every other field is left
  // alone rather than round-tripped through the browser, so nothing the
  // interface never displayed can be overwritten by displaying it.
  const move = async (id: string, status: string): Promise<void> => {
    setFailure(undefined);
    try {
      await api.updateTask({ id, status });
      refresh();
    } catch (problem) {
      setFailure(describeError(problem));
    }
  };

  return (
    <>
      <h1>Tasks</h1>
      <p className="subtitle">Units of work ctxd is tracking.</p>

      <div className="toolbar">
        <input
          type="text"
          placeholder="New task…"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && title.trim() !== "") void create();
          }}
        />
        <button className="button" disabled={busy || title.trim() === ""} onClick={() => void create()}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {failure !== undefined ? <WriteResult message={failure} tone="refused" /> : null}

      <Panel
        loading={loading}
        error={error}
        empty={tasks.length === 0}
        emptyMessage="No tasks yet. Add one above, or run: ctxd task add …"
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
                      <select
                        aria-label={`Status of ${task.title}`}
                        value={task.status}
                        onChange={(event) => void move(task.id, event.target.value)}
                      >
                        {COLUMNS.map((option) => (
                          <option key={option} value={option}>
                            {option.replace("_", " ")}
                          </option>
                        ))}
                      </select>
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
  const { data, error, loading, refresh } = useApi(() => api.resume());

  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; tone: "ok" | "refused" } | undefined>();

  const run = async (what: "session" | "checkpoint"): Promise<void> => {
    setBusy(true);
    setResult(undefined);
    try {
      if (what === "session") {
        await api.startSession({});
        // Starting twice returns the open session rather than opening a
        // second, so this is safe to press again and says so.
        setResult({ message: "Session open.", tone: "ok" });
      } else {
        await api.createCheckpoint(next.trim() === "" ? {} : { next });
        setResult({ message: "Checkpoint recorded.", tone: "ok" });
        setNext("");
      }
      refresh();
    } catch (problem) {
      setResult({ message: describeError(problem), tone: "refused" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Resume</h1>
      <p className="subtitle">What was I doing?</p>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Next action — what should the next session do first?"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void run("checkpoint");
          }}
        />
        <button className="button" disabled={busy} onClick={() => void run("checkpoint")}>
          Checkpoint
        </button>
        <button className="button" disabled={busy} onClick={() => void run("session")}>
          Start session
        </button>
      </div>
      {result !== undefined ? <WriteResult message={result.message} tone={result.tone} /> : null}

      <Panel loading={loading} error={error}>
        <pre>{data?.resume}</pre>
      </Panel>
    </>
  );
}

/* Worker monitor (§69) ------------------------------------------------------ */

function connectionTone(state: string): string {
  switch (state) {
    case "connected":
    case "working":
      return "ok";
    case "error":
      return "danger";
    case "disconnected":
      return "warn";
    default:
      return "";
  }
}

/**
 * Say what the connection state is based on, in words.
 *
 * The open-ended case matters most: a worker whose process was killed cannot
 * write a disconnect, so "connected" can outlive the connection. Rather than
 * invent a timeout and present the guess as knowledge, the panel says when the
 * attachment was seen and lets the developer judge the age (§37).
 */
function connectionNote(connection: WorkerConnection): string {
  switch (connection.state) {
    case "connected":
      return `attached ${formatTime(connection.since ?? "")}${
        connection.openEnded ? " — no disconnect recorded since" : ""
      }`;
    case "working":
      return `request in progress since ${formatTime(connection.since ?? "")}`;
    case "error":
      return `last request failed ${formatTime(connection.since ?? "")}`;
    case "disconnected":
      return `detached ${formatTime(connection.since ?? "")}`;
    default:
      return "no connection events recorded — run ctxd mcp --worker <name> to attribute activity";
  }
}

export function WorkerMonitor(): ReactNode {
  const { data, error, loading, refresh } = useApi(() => api.workers());
  const workers = data?.workers ?? [];

  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; tone: "ok" | "refused" } | undefined>();

  /**
   * Hand the work to another worker (`ctxd handoff`).
   *
   * Naming nobody assembles the handoff without moving anything, so a person
   * can read what would travel before committing to it.
   */
  const hand = async (move: boolean): Promise<void> => {
    setBusy(true);
    setResult(undefined);
    try {
      const done = await api.handoff(
        move
          ? { to, ...(note.trim() === "" ? {} : { note }) }
          : {},
      );
      const warnings = done.warnings ?? [];
      setResult({
        message: done.moved
          ? `Work moved to ${done.toWorker ?? to}.${warnings.length > 0 ? ` ${warnings.join(" ")}` : ""}`
          : "Handoff assembled. Nothing has moved.",
        // A warning is not a failure, but it must not read like clean success.
        tone: warnings.length > 0 ? "refused" : "ok",
      });
      if (move) setNote("");
      refresh();
    } catch (problem) {
      setResult({ message: describeError(problem), tone: "refused" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Workers</h1>
      <p className="subtitle">
        Who has been working on this project. Workers are replaceable; the memory is not.
      </p>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Hand off to… (claude, cursor, …)"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <input
          type="text"
          placeholder="Note for whoever picks it up"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button className="button" disabled={busy || to.trim() === ""} onClick={() => void hand(true)}>
          Hand off
        </button>
        <button className="button" disabled={busy} onClick={() => void hand(false)}>
          Preview
        </button>
      </div>
      {result !== undefined ? <WriteResult message={result.message} tone={result.tone} /> : null}

      <Panel loading={loading} error={error}>
        <div className="rows">
          {workers.map((worker) => (
            <div className="row" key={worker.id}>
              <div className="row-head">
                <strong>{worker.name}</strong>
                <span className={`tag ${connectionTone(worker.connection.state)}`}>
                  {worker.connection.state}
                </span>
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
              <div className="reason">{connectionNote(worker.connection)}</div>
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
          involved, and a worker it has never heard of appears here just the same. Connection
          state comes from the event log; the name attached to it is whatever the worker was
          configured to call itself, which ctxd cannot verify.
        </p>
      </Panel>
    </>
  );
}

/* Settings (§67) ------------------------------------------------------------ */

/**
 * Where the developer supplies the local API token.
 *
 * The token is not shipped to the page: it is a credential, and a page that
 * received it automatically would also hand it to anything else able to
 * `GET /`. It is entered once and kept in `localStorage` — the same trade the
 * 401 hint describes.
 */
function TokenSetting(): ReactNode {
  const [token, setToken] = useState(storedToken());
  const [saved, setSaved] = useState(false);

  const held = storedToken() !== "";

  return (
    <>
      <h2>API token</h2>
      <p className="disclaimer">
        Reading needs no token. Recording a memory, adding or moving a task, and
        taking a checkpoint do — get it with <code>ctxd ui --print-token</code>.
        It is kept in this browser only and never sent anywhere but this local
        API.
      </p>
      <div className="toolbar">
        <input
          type="password"
          aria-label="Local API token"
          placeholder={held ? "A token is stored" : "Paste the local API token"}
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setSaved(false);
          }}
        />
        <button
          className="button"
          onClick={() => {
            storeToken(token);
            setSaved(true);
          }}
        >
          Save
        </button>
        <button
          className="button"
          onClick={() => {
            storeToken("");
            setToken("");
            setSaved(false);
          }}
        >
          Forget
        </button>
      </div>
      {saved ? <WriteResult message="Token stored in this browser." tone="ok" /> : null}
    </>
  );
}

export function SettingsView(): ReactNode {
  const { data, error, loading } = useApi(() => api.settings());

  return (
    <>
      <h1>Settings</h1>
      <p className="subtitle">
        Configuration is read-only — the file is the interface. The API token is
        stored in this browser.
      </p>

      <Panel loading={loading} error={error}>
        <TokenSetting />

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
