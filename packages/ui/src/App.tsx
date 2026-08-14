import { useState, type ReactNode } from "react";
import { ActivityStream } from "./activity.js";
import { EngineeringGraph } from "./graph.js";
import { TokenMonitor } from "./tokens.js";
import {
  Agent,
  ChangeInspector,
  ContextInspector,
  Dashboard,
  MemoryViewer,
  Projects,
  Resume,
  SettingsView,
  TaskBoard,
  Verification,
  WorkerMonitor,
} from "./panels.js";

/**
 * The shell.
 *
 * Navigation is component state rather than a router: a dozen panels do not need
 * URL routing, and a router would be the first dependency added for tidiness
 * rather than need.
 */

const PANELS = [
  // The graph is the home screen (§30): it is the visual representation of the
  // architecture, not an optional extra view of it.
  { id: "graph", label: "Graph", render: () => <EngineeringGraph /> },
  { id: "dashboard", label: "Dashboard", render: () => <Dashboard /> },
  // Registering a project is where a GUI-first session starts, so it sits
  // beside the overview rather than buried under settings.
  { id: "projects", label: "Projects", render: () => <Projects /> },
  { id: "activity", label: "Activity", render: () => <ActivityStream /> },
  // The loop a developer watches rather than drives: context, routing, worker,
  // change review. Placed beside Context because it is that panel plus a run.
  { id: "agent", label: "Agent", render: () => <Agent /> },
  { id: "context", label: "Context", render: () => <ContextInspector /> },
  { id: "tokens", label: "Tokens", render: () => <TokenMonitor /> },
  { id: "changes", label: "Changes", render: () => <ChangeInspector /> },
  { id: "verify", label: "Verify", render: () => <Verification /> },
  { id: "memory", label: "Memory", render: () => <MemoryViewer /> },
  { id: "tasks", label: "Tasks", render: () => <TaskBoard /> },
  { id: "resume", label: "Resume", render: () => <Resume /> },
  { id: "workers", label: "Workers", render: () => <WorkerMonitor /> },
  { id: "settings", label: "Settings", render: () => <SettingsView /> },
] as const;

export function App(): ReactNode {
  const [active, setActive] = useState<string>("graph");
  const panel = PANELS.find((entry) => entry.id === active) ?? PANELS[0];

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          ctxd
          <span>context firewall</span>
        </div>

        {PANELS.map((entry) => (
          <button
            key={entry.id}
            className="nav-item"
            aria-current={entry.id === active}
            onClick={() => setActive(entry.id)}
          >
            {entry.label}
          </button>
        ))}

        <div className="sidebar-foot">
          Local only. No cloud, no telemetry. Token counts are estimates.
        </div>
      </nav>

      <main className="main">{panel.render()}</main>
    </div>
  );
}
