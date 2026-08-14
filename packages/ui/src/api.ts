/**
 * Typed access to the local ctxd API.
 *
 * Every call is same-origin: the interface is served by the API itself, so
 * there is no base URL to configure and no cross-origin request to authorise.
 */

export interface Status {
  readonly version: string;
  readonly mode: string;
  readonly dataDir: string;
  readonly dir: string;
  readonly projects: number;
  readonly git: string;
  readonly tokenCounting: string;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly root: string;
  readonly language?: string | null;
  readonly framework?: string | null;
  readonly package_manager?: string | null;
  readonly updated_at?: string;
}

export interface Memory {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly content: string;
  readonly importance: number;
  readonly confidence: number;
  readonly source: string;
  readonly status: string;
  readonly created_at: string;
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: number;
  readonly worker?: string | null;
  readonly description?: string | null;
}

export interface ReceiptItem {
  readonly path: string;
  readonly token_count: number;
  readonly reason: string;
  readonly priority: string;
  readonly compressed?: boolean;
}

export interface ContextReceipt {
  readonly request_id: string;
  readonly timestamp: string;
  readonly task: string;
  readonly project: string;
  /** Self-declared requester. Absent on receipts written before it was recorded. */
  readonly claimed_worker?: string;
  readonly budget: number;
  readonly candidate_total_tokens: number;
  readonly final_total_tokens: number;
  readonly token_count_estimation: string;
  readonly removed_tokens: {
    readonly duplicate_tokens: number;
    readonly irrelevant_tokens: number;
    readonly low_priority_tokens: number;
    readonly compressed_tokens: number;
  };
  readonly included_items: readonly ReceiptItem[];
  readonly excluded_items: readonly ReceiptItem[];
  readonly warnings: readonly string[];
}

export interface ChangeReceiptFile {
  readonly path: string;
  readonly kind: string;
  readonly lines_added: number;
  readonly lines_removed: number;
  readonly semantic_lines: number;
  readonly formatting_lines: number;
  readonly related: boolean;
  readonly reason: string;
}

export interface ChangeSignal {
  readonly id: string;
  readonly severity: string;
  readonly summary: string;
  readonly evidence: string;
}

export interface ChangeReceipt {
  readonly request_id: string;
  readonly timestamp: string;
  readonly task: string;
  readonly worker: string;
  /** What the diff was taken against, e.g. "HEAD (staged + unstaged)". */
  readonly scope: string;
  readonly files_changed: number;
  readonly lines_added: number;
  readonly lines_removed: number;
  readonly lines_modified: number;
  readonly semantic_lines: number;
  readonly formatting_lines: number;
  readonly formatting_only_changes: number;
  readonly comment_only_changes: number;
  readonly import_only_changes: number;
  readonly unrelated_files: readonly string[];
  readonly dependency_changes: number;
  readonly generated_file_changes: number;
  readonly rename_changes: number;
  readonly whole_file_rewrites: number;
  /** The expectation the task implied, against which the diff was judged (§51). */
  readonly expected_size: string;
  readonly expected_files: number | null;
  readonly expected_lines: number | null;
  readonly classification: string;
  readonly classification_reasons: readonly string[];
  readonly recommendation: string;
  readonly risk: string;
  readonly change_efficiency_score: number;
  readonly verification_status: string;
  readonly signals: readonly ChangeSignal[];
  /** Comments that restate the syntax. Flagged, never deleted (§54). */
  readonly comments_flagged: readonly string[];
  readonly files: readonly ChangeReceiptFile[];
  readonly warnings: readonly string[];
  readonly algorithm_version: string;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(scoped(path), { headers: { accept: "application/json" } });
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new ApiError(response.status, payload.error ?? `request failed (${response.status})`);
  }
  return payload;
}

export interface CtxdEvent {
  readonly id: number;
  readonly type: string;
  readonly timestamp: string;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly taskId: string | null;
  /**
   * What the producer said it was.
   *
   * Named `claimedWorker` rather than `worker` because ctxd cannot check it:
   * the MCP server observes that a client attached, not which one. Render it
   * as a claim, never as an identity ctxd verified.
   */
  readonly claimedWorker: string | null;
  readonly data: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GraphWorkerNode {
  readonly id: string;
  readonly claimedName: string;
  readonly connection: string;
  readonly since: string | null;
  readonly openEnded: boolean;
  readonly currentTask: string | null;
}

export interface CtxdGraph {
  readonly core: {
    readonly version: string;
    readonly mode: string;
    readonly dir: string;
    readonly projects: number;
    readonly workersAttached: number;
    readonly workersKnown: number;
  };
  readonly context: {
    readonly lastRequestId: string | null;
    readonly lastAt: string | null;
    readonly candidateTokens: number | null;
    readonly finalTokens: number | null;
    readonly claimedWorker: string | null;
    readonly accuracy: string;
  };
  readonly memory: { readonly total: number; readonly byType: Record<string, number> };
  readonly repository: { readonly git: string; readonly dir: string };
  readonly verification: {
    readonly status: string;
    readonly at: string | null;
    readonly source: string;
    /** current | stale | unknown — judged against the tree, not a clock (UI-8). */
    readonly freshness: string;
    readonly changedSince: string | null;
    readonly reason: string;
  };
  readonly tasks: { readonly total: number; readonly inProgress: number };
  readonly workers: readonly GraphWorkerNode[];
}

/** The reporting windows `/api/stats` accepts. Named by the core, not here. */
export type StatsWindow = "today" | "7d" | "30d" | "all";

export interface Stats {
  readonly window: StatsWindow;
  readonly scope: string;
  /** The cutoff the window resolved to, or null for everything on disk. */
  readonly since: string | null;
  readonly context: {
    readonly requests: number;
    readonly candidateTokens: number;
    readonly finalTokens: number;
    readonly avoidedTokens: number;
    readonly duplicateTokens: number;
    readonly irrelevantTokens: number;
    readonly lowPriorityTokens: number;
    readonly compressedTokens: number;
    /** exact | estimated | unknown — never dropped, never assumed. */
    readonly accuracy: string;
    readonly firstAt?: string;
    readonly lastAt?: string;
  };
  readonly change: {
    readonly reviews: number;
    readonly filesChanged: number;
    readonly linesAdded: number;
    readonly linesRemoved: number;
    readonly semanticLines: number;
    readonly formattingLines: number;
    readonly unrelatedFiles: number;
    readonly dependencyChanges: number;
    readonly meanEfficiency?: number;
    readonly byClassification: Readonly<Record<string, number>>;
    readonly byVerification: Readonly<Record<string, number>>;
  };
  /** Receipts that could not be read, so a gap in the total is never silent. */
  readonly unreadable: readonly string[];
}

/*
 * Writes (2.1)
 * -----------------------------------------------------------------------------
 *
 * Mutating routes require the local API token (§62). The interface is served
 * over HTTP like any other page, so it does not receive the token
 * automatically — the developer supplies it once from `ctxd ui --print-token`
 * and it is kept in `localStorage`.
 *
 * Injecting the token into the served HTML instead would remove that step, and
 * would also mean any local process able to `GET /` could read a credential
 * that currently requires reading a `0600` file. The paste is the cheaper
 * price.
 */

const TOKEN_KEY = "ctxd.apiToken";
const PROJECT_KEY = "ctxd.project";

/**
 * Which project the interface is looking at.
 *
 * Empty means "let the server decide", which resolves to the directory it was
 * started on. Choosing one here is what stops the window being tied to
 * whatever `ctxd desktop --dir` pointed at, so a person can register several
 * projects and move between them without restarting anything.
 */
export function selectedProject(): string {
  try {
    return localStorage.getItem(PROJECT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function selectProject(id: string): void {
  try {
    if (id === "") localStorage.removeItem(PROJECT_KEY);
    else localStorage.setItem(PROJECT_KEY, id);
  } catch {
    // Storage unavailable; the server's own default still applies.
  }
}

/** Append the chosen project to a path, preserving any query it already has. */
function scoped(path: string): string {
  const project = selectedProject();
  if (project === "") return path;
  return `${path}${path.includes("?") ? "&" : "?"}project=${encodeURIComponent(project)}`;
}

export function storedToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    // Storage can be unavailable (private mode, disabled cookies). Writes then
    // fail with a 401 that says what to do, which beats crashing the panel.
    return "";
  }
}

export function storeToken(token: string): void {
  try {
    if (token.trim() === "") localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token.trim());
  } catch {
    // As above.
  }
}

async function mutate<T>(path: string, method: string, body: unknown): Promise<T> {
  const token = storedToken();
  const project = selectedProject();

  // The chosen project travels in the body, which is where the write routes
  // look first. A write must never land in a different project from the one
  // the panels were showing when the developer pressed the button.
  const scopedBody =
    project === "" || (body as { project?: unknown })?.project !== undefined
      ? body
      : { ...(body as Record<string, unknown>), project };

  const response = await fetch(path, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(scopedBody),
  });

  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    // 401 is the one worth naming: it means the token is missing or stale, and
    // the fix is a specific command rather than a retry.
    const message =
      response.status === 401
        ? "this action needs the local API token — add it in Settings (ctxd ui --print-token)"
        : (payload.error ?? `request failed (${response.status})`);
    throw new ApiError(response.status, message);
  }
  return payload;
}

export interface AgentRunner {
  readonly id: string;
  readonly name: string;
  /** False for a worker ctxd cannot start; `detail` says why. */
  readonly available: boolean;
  readonly detail?: string;
}

export interface AgentRun {
  readonly task: string;
  readonly routing: {
    readonly worker: string;
    readonly model: string;
    /** Every choice carries its reason, as context receipts do. */
    readonly reasons: readonly string[];
  };
  readonly contextReceipt: ContextReceipt;
  readonly worker: {
    readonly ok: boolean;
    readonly result: string;
    readonly turns?: number;
    readonly durationMs: number;
    /** Reported by the worker. On a subscription this is notional, not a bill. */
    readonly reportedCostUsd?: number;
    readonly error?: string;
  };
  /** Present only when the worker was allowed to edit. */
  readonly change?: ChangeReceipt;
}

export interface VerificationCheck {
  readonly kind: string;
  /** A skipped check is never rendered as a pass (§13). */
  readonly status: string;
  readonly command: string;
  readonly exitCode?: number;
  readonly durationMs: number;
  readonly detail: string;
  /** Kept only for failures — a pass has nothing to explain. */
  readonly output?: string;
}

export interface VerificationResult {
  readonly status: string;
  readonly checks: readonly VerificationCheck[];
  readonly violations: readonly { readonly rule: string; readonly detail: string }[];
  readonly changedFiles: readonly string[];
  readonly reasons: readonly string[];
  readonly timestamp: string;
}

export interface SaveMemoryBody {
  readonly title: string;
  readonly content: string;
  readonly type?: string;
  readonly source?: string;
  readonly importance?: string;
  readonly tags?: readonly string[];
}

export const api = {
  status: () => request<Status>("/api/status"),
  graph: () => request<CtxdGraph>("/api/graph"),
  stats: (window: StatsWindow) => request<Stats>(`/api/stats?window=${window}`),
  recentEvents: (limit = 50) =>
    request<{ events: CtxdEvent[]; latestId: number }>(`/api/events/recent?limit=${limit}`),
  projects: () => request<{ projects: Project[] }>("/api/projects"),
  memories: (query: string) =>
    request<{ memories?: Memory[]; hits?: Memory[] }>(
      query.trim() === "" ? "/api/memory" : `/api/memory?q=${encodeURIComponent(query)}`,
    ),
  tasks: () => request<{ tasks: Task[] }>("/api/tasks"),
  resume: () => request<{ resume: string }>("/api/resume"),
  contextReceipts: () => request<{ receipts: ContextReceipt[] }>("/api/receipts/context"),
  changeReceipts: () => request<{ receipts: ChangeReceipt[] }>("/api/receipts/change"),
  workers: () => request<{ workers: Worker[] }>("/api/workers"),
  settings: () => request<Settings>("/api/config"),
  diff: (task: string) =>
    request<ChangeReceipt>(
      task.trim() === "" ? "/api/diff" : `/api/diff?task=${encodeURIComponent(task)}`,
    ),

  // Writes. Each one is the route that calls the same core function the
  // equivalent CLI command calls — see api.md.
  saveMemory: (body: SaveMemoryBody) =>
    mutate<{ outcome: string; memory: Memory; supersedes?: string }>(
      "/api/memory",
      "POST",
      body,
    ),
  createTask: (body: { title: string; description?: string; priority?: string }) =>
    mutate<Task>("/api/tasks", "POST", body),
  updateTask: (body: { id: string; status?: string; priority?: string; worker?: string }) =>
    mutate<Task>("/api/tasks", "PATCH", body),
  startSession: (body: { worker?: string; task?: string }) =>
    mutate<{ id: string }>("/api/session", "POST", body),
  createCheckpoint: (body: { next?: string; objective?: string; worker?: string }) =>
    mutate<{ id: string }>("/api/checkpoint", "POST", body),
  buildContext: (body: { task: string; budget?: number; worker?: string }) =>
    mutate<{ receipt: ContextReceipt; warnings: readonly string[] }>(
      "/api/context",
      "POST",
      body,
    ),
  agentRunners: () => request<{ runners: AgentRunner[] }>("/api/agent"),
  runAgent: (body: {
    task: string;
    budget?: number;
    worker?: string;
    model?: string;
    applyEdits?: boolean;
  }) => mutate<AgentRun>("/api/agent", "POST", body),
  verify: (body: { dryRun?: boolean; only?: readonly string[]; timeoutMs?: number }) =>
    mutate<VerificationResult>("/api/verify", "POST", body),
  handoff: (body: { to?: string; from?: string; task?: string; note?: string }) =>
    mutate<{ moved: boolean; toWorker?: string; warnings?: readonly string[] }>(
      "/api/handoff",
      "POST",
      body,
    ),
  registerProject: (body: { dir: string; index?: boolean }) =>
    mutate<{
      outcome: string;
      project: Project;
      evidence: readonly string[];
      indexed?: { total: number; added: number; updated: number; unchanged: number; removed: number };
    }>("/api/projects", "POST", body),
};

export interface WorkerConnection {
  /** connected | working | error | disconnected | unknown */
  readonly state: string;
  readonly since: string | null;
  readonly lastActivityAt: string | null;
  /** Observed attaching, never observed leaving — which a killed process cannot do. */
  readonly openEnded: boolean;
  /** Always true: the name is self-declared and ctxd cannot check it (§6). */
  readonly claimed: boolean;
}

export interface Worker {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly string[];
  /** What the session history says: active | idle | unknown. */
  readonly state: string;
  readonly source: string;
  readonly lastActivity: string | null;
  readonly currentTask: string | null;
  readonly lastTask: string | null;
  readonly lastSummary: string | null;
  /** What the event log says right now. Answers a different question to `state`. */
  readonly connection: WorkerConnection;
}

export interface Settings {
  readonly config: Record<string, unknown>;
  readonly configFile: string;
  readonly dataDir: string;
  readonly editable: boolean;
  readonly note: string;
}

/**
 * Subscribe to the live event stream.
 *
 * One subscription for the whole interface, not one per panel: every panel
 * that wants live activity reads from the same connection, so the API sees a
 * single stream regardless of how many views are open.
 *
 * Reconnection is `EventSource`'s own — it resends the last event id it saw,
 * and the server replays only what was missed, so a dropped connection costs
 * nothing but the gap.
 */
export function subscribeToEvents(
  onEvent: (event: CtxdEvent) => void,
  onStateChange?: (connected: boolean) => void,
): () => void {
  const source = new EventSource("/api/events");

  const handle = (message: MessageEvent<string>): void => {
    try {
      onEvent(JSON.parse(message.data) as CtxdEvent);
    } catch {
      // A frame that will not parse is dropped rather than rendered. Showing a
      // malformed event as activity would be inventing activity.
    }
  };

  // Every event carries its type as the SSE event name, so a named listener is
  // needed per type; the default `message` handler would never fire.
  const types = [
    "worker_connected",
    "worker_disconnected",
    "worker_request_started",
    "worker_request_finished",
    "worker_error",
    "context_requested",
    "context_built",
    "verification_started",
    "verification_finished",
    "memory_updated",
    "task_updated",
    "checkpoint_created",
    "handoff_created",
    "change_analyzed",
  ];
  for (const type of types) source.addEventListener(type, handle as EventListener);

  source.addEventListener("open", () => onStateChange?.(true));
  source.addEventListener("error", () => onStateChange?.(false));

  return () => {
    for (const type of types) source.removeEventListener(type, handle as EventListener);
    source.close();
  };
}
