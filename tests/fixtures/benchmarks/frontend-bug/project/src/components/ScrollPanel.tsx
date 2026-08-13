import type { ReactNode } from "react";
import "./ScrollPanel.css";

/** A scrolling container. Anything absolutely positioned inside it will clip. */
export function ScrollPanel(props: { children: ReactNode }) {
  return <div className="scroll-panel">{props.children}</div>;
}
