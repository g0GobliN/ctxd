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
  readonly files_changed: number;
  readonly lines_added: number;
  readonly lines_removed: number;
  readonly semantic_lines: number;
  readonly formatting_lines: number;
  readonly unrelated_files: readonly string[];
  readonly dependency_changes: number;
  readonly classification: string;
  readonly classification_reasons: readonly string[];
  readonly recommendation: string;
  readonly risk: string;
  readonly change_efficiency_score: number;
  readonly verification_status: string;
  readonly signals: readonly ChangeSignal[];
  readonly files: readonly ChangeReceiptFile[];
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

export const api = {
  status: () => request<Status>("/api/status"),
  projects: () => request<{ projects: Project[] }>("/api/projects"),
  memories: (query: string) =>
    request<{ memories?: Memory[]; hits?: Memory[] }>(
      query.trim() === "" ? "/api/memory" : `/api/memory?q=${encodeURIComponent(query)}`,
    ),
  tasks: () => request<{ tasks: Task[] }>("/api/tasks"),
  resume: () => request<{ resume: string }>("/api/resume"),
  contextReceipts: () => request<{ receipts: ContextReceipt[] }>("/api/receipts/context"),
  changeReceipts: () => request<{ receipts: ChangeReceipt[] }>("/api/receipts/change"),
  diff: (task: string) =>
    request<ChangeReceipt>(
      task.trim() === "" ? "/api/diff" : `/api/diff?task=${encodeURIComponent(task)}`,
    ),
};
