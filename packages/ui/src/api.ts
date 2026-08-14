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
  const response = await fetch(path, { headers: { accept: "application/json" } });
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
