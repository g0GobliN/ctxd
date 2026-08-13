/**
 * Offline mode (§66).
 *
 * "Graceful degradation is mandatory" is easy to write and easy to quietly
 * break. This module states, as data, which capabilities work with no AI
 * provider — and every one of them is `true`, because ctxd's whole design puts
 * deterministic tooling first and treats a model as an accelerator.
 *
 * Keeping it as data rather than prose means the claim can be tested and shown
 * in `ctxd doctor`, instead of living only in a README that drifts.
 */

import { hasAny, type AiProviders } from "./interfaces.js";

export interface Capability {
  readonly id: string;
  readonly label: string;
  /** Does this work with no AI provider configured? */
  readonly worksOffline: boolean;
  /** How it works without one. */
  readonly how: string;
}

/**
 * Every capability §66 requires to survive without a provider.
 *
 * If a future change makes one of these depend on a model, this table has to
 * change too — and the test that asserts they are all offline-capable will
 * fail, which is the point.
 */
export const CAPABILITIES: readonly Capability[] = [
  {
    id: "search",
    label: "Local search",
    worksOffline: true,
    how: "SQLite FTS5 over indexed memory; no embeddings required",
  },
  {
    id: "memory",
    label: "Project memory",
    worksOffline: true,
    how: "SQLite plus Markdown bodies, with a deterministic authority order",
  },
  {
    id: "git",
    label: "Git awareness",
    worksOffline: true,
    how: "read-only Git inspection; Git remains the source of truth",
  },
  {
    id: "tasks",
    label: "Tasks",
    worksOffline: true,
    how: "stored locally in SQLite",
  },
  {
    id: "sessions",
    label: "Sessions and checkpoints",
    worksOffline: true,
    how: "stored locally; resume and handoff are assembled deterministically",
  },
  {
    id: "tokens",
    label: "Token counting",
    worksOffline: true,
    how: "a local heuristic estimator, always labelled as an estimate",
  },
  {
    id: "context",
    label: "Context construction",
    worksOffline: true,
    how: "collection, dedup, ranking, budget and compression are all deterministic",
  },
  {
    id: "diff",
    label: "Diff analysis",
    worksOffline: true,
    how: "the Diff Firewall parses Git output; no model is consulted",
  },
  {
    id: "verification",
    label: "Verification",
    worksOffline: true,
    how: "runs the project's own typecheck, lint, test and build commands",
  },
  {
    id: "ui",
    label: "Interface",
    worksOffline: true,
    how: "static files served by the local API; nothing is fetched remotely",
  },
  {
    id: "cli",
    label: "CLI",
    worksOffline: true,
    how: "every command works with no provider configured",
  },
];

export interface OfflineReport {
  readonly providersConfigured: boolean;
  readonly providers: readonly string[];
  readonly capabilities: readonly Capability[];
  /** True when every required capability survives without a provider. */
  readonly fullyOffline: boolean;
}

export function offlineReport(providers: AiProviders = {}): OfflineReport {
  const names: string[] = [];
  if (providers.summarizer !== undefined) names.push(`summarizer:${providers.summarizer.name}`);
  if (providers.memoryExtractor !== undefined) {
    names.push(`extractor:${providers.memoryExtractor.name}`);
  }
  if (providers.embeddings !== undefined) names.push(`embeddings:${providers.embeddings.name}`);
  if (providers.classifier !== undefined) names.push(`classifier:${providers.classifier.name}`);

  return {
    providersConfigured: hasAny(providers),
    providers: names,
    capabilities: CAPABILITIES,
    fullyOffline: CAPABILITIES.every((capability) => capability.worksOffline),
  };
}

export function formatOfflineReport(report: OfflineReport): string {
  const lines: string[] = [
    "OFFLINE CAPABILITY",
    "",
    report.providersConfigured
      ? `AI providers configured: ${report.providers.join(", ")}`
      : "AI providers configured: none — this is the normal configuration",
    "",
  ];

  for (const capability of report.capabilities) {
    lines.push(`  ${capability.worksOffline ? "✓" : "✗"} ${capability.label}`);
    lines.push(`      ${capability.how}`);
  }

  lines.push(
    "",
    report.fullyOffline
      ? "Every capability above works with no AI provider and no network."
      : "Some capabilities require a provider — this violates §66.",
  );

  return lines.join("\n");
}
