import { useState, type ReactNode } from "react";
import {
  ChangeInspector,
  ContextInspector,
  Dashboard,
  MemoryViewer,
  Resume,
  TaskBoard,
} from "./panels.js";

/**
 * The shell.
 *
 * Navigation is component state rather than a router: six panels do not need
 * URL routing, and a router would be the first dependency added for tidiness
 * rather than need.
 */

const PANELS = [
  { id: "dashboard", label: "Dashboard", render: () => <Dashboard /> },
  { id: "context", label: "Context", render: () => <ContextInspector /> },
  { id: "changes", label: "Changes", render: () => <ChangeInspector /> },
  { id: "memory", label: "Memory", render: () => <MemoryViewer /> },
  { id: "tasks", label: "Tasks", render: () => <TaskBoard /> },
  { id: "resume", label: "Resume", render: () => <Resume /> },
] as const;

export function App(): ReactNode {
  const [active, setActive] = useState<string>("dashboard");
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
