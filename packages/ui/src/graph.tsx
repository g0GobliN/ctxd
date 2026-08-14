/**
 * The engineering graph (§4, §5, UI-3).
 *
 * Hand-written SVG. A graph library would be the largest dependency in the
 * repository, bought for one screen holding fewer than ten nodes — and this
 * layout is fixed rather than force-directed, so there is no simulation to run.
 *
 * The picture makes one claim: everything reaches the workers *through* ctxd.
 * Repository, memory and verification connect to the core, never to a worker,
 * because that is the actual architecture and a diagram that drew it otherwise
 * would be selling something the code does not do.
 *
 * Every value shown comes from `/api/graph`. Nothing is computed here — the
 * interface lays out what the core already decided.
 *
 * UI-4 makes it live. The movement is driven by the event log and by nothing
 * else: an element lights up because a producer wrote a row, and the numbers
 * change because the graph was rebuilt from the core afterwards. There is no
 * animation on a timer, and no element that pulses to look busy.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { api, subscribeToEvents, type CtxdGraph } from "./api.js";
import { formatTime, Panel, useApi } from "./common.js";
import {
  coreOffset,
  CORE,
  IDENTITY,
  NODE,
  panBy,
  placeWorkers,
  requiredHeight,
  toGraphDelta,
  transformOf,
  VIEW,
  zoomAt,
  type Placed,
  type Viewport,
} from "./graph-layout.js";
import {
  activeElements,
  affectsGraphData,
  applyPulse,
  CORE as CORE_KEY,
  EDGE_MEMORY,
  EDGE_REPOSITORY,
  EDGE_VERIFICATION,
  MEMORY as MEMORY_KEY,
  prunePulses,
  REPOSITORY as REPOSITORY_KEY,
  VERIFICATION as VERIFICATION_KEY,
  workerEdgeKey,
  workerKey,
  type Pulses,
} from "./live.js";

/**
 * When the worker row collapses by default.
 *
 * Past this many, the individual boxes stop being the useful view and the
 * cluster becomes the thing worth seeing. Collapsed is a default, never a
 * ceiling — expanding always works, and the count is always stated.
 */
const COLLAPSE_ABOVE = 6;

function tone(state: string): string {
  switch (state) {
    case "connected":
    case "working":
    case "PASS":
      return "ok";
    case "error":
    case "FAIL":
      return "danger";
    case "disconnected":
    case "NEEDS_REVIEW":
      return "warn";
    default:
      return "muted";
  }
}

/**
 * How long to wait before rebuilding the graph after an event.
 *
 * A burst of tool calls arrives as a burst of events; refetching per event
 * would put the API under load proportional to worker chatter for no gain,
 * since the second rebuild would overwrite the first before it was read.
 */
const REFRESH_DEBOUNCE_MS = 350;

/** How often a live pulse is re-evaluated as it decays. */
const DECAY_TICK_MS = 300;

/**
 * Subscribe the graph to the event log.
 *
 * Two separate effects: one owns the stream for the life of the panel, the
 * other runs only while something is actually lit. Stopping the timer when
 * nothing is pulsing is what keeps an idle graph genuinely idle rather than
 * re-rendering four times a second in the background.
 */
function useLiveGraph(reload: () => void): {
  active: ReadonlySet<string>;
  streaming: boolean | undefined;
} {
  const [pulses, setPulses] = useState<Pulses>(() => new Map());
  const [streaming, setStreaming] = useState<boolean | undefined>(undefined);

  // Held in a ref so a new `reload` identity each render does not tear down
  // and re-open the event stream.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = subscribeToEvents((event) => {
      setPulses((current) => applyPulse(current, event, Date.now()));

      if (affectsGraphData() && pending === undefined) {
        pending = setTimeout(() => {
          pending = undefined;
          reloadRef.current();
        }, REFRESH_DEBOUNCE_MS);
      }
    }, setStreaming);

    return () => {
      if (pending !== undefined) clearTimeout(pending);
      unsubscribe();
    };
  }, []);

  const idle = pulses.size === 0;
  useEffect(() => {
    if (idle) return;
    const timer = setInterval(
      () => setPulses((current) => prunePulses(current, Date.now())),
      DECAY_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [idle]);

  return { active: activeElements(pulses, Date.now()), streaming };
}

/**
 * Pan, zoom and node dragging (UI-9).
 *
 * Pointer events rather than mouse events, so a trackpad, a stylus and a touch
 * screen all work from one code path. Capture is taken on the element that
 * started the gesture, which is what stops a fast drag from being lost the
 * moment the pointer leaves the SVG.
 *
 * Dragged positions live here and not on the server: where a developer parked a
 * node is a view preference, not something ctxd knows about the project.
 */
function useGraphInteraction(): {
  viewport: Viewport;
  moved: ReadonlyMap<string, { x: number; y: number }>;
  reset: () => void;
  zoom: (factor: number) => void;
  svgProps: {
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
  };
  panning: boolean;
  beginNodeDrag: (id: string, event: ReactPointerEvent) => void;
} {
  const [viewport, setViewport] = useState<Viewport>(IDENTITY);
  const [moved, setMoved] = useState<Map<string, { x: number; y: number }>>(() => new Map());
  const [panning, setPanning] = useState(false);

  // A ref rather than state: a gesture updates on every pointer move, and
  // re-rendering to record "still dragging" would be work for nothing.
  const gesture = useRef<
    { kind: "pan" | "node"; id?: string; lastX: number; lastY: number } | undefined
  >(undefined);

  const reset = useCallback(() => {
    setViewport(IDENTITY);
    setMoved(new Map());
  }, []);

  const zoom = useCallback((factor: number) => {
    // Button zoom is about the centre, since there is no cursor to anchor to.
    setViewport((current) =>
      zoomAt(current, factor, { x: VIEW.width / 2, y: VIEW.height / 2 }),
    );
  }, []);

  const beginNodeDrag = useCallback((id: string, event: ReactPointerEvent) => {
    gesture.current = { kind: "node", id, lastX: event.clientX, lastY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>): void => {
    if (gesture.current !== undefined) return;
    gesture.current = { kind: "pan", lastX: event.clientX, lastY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>): void => {
    const active = gesture.current;
    if (active === undefined) return;

    const dx = event.clientX - active.lastX;
    const dy = event.clientY - active.lastY;
    active.lastX = event.clientX;
    active.lastY = event.clientY;

    if (active.kind === "pan") {
      setViewport((current) => panBy(current, dx, dy));
      return;
    }

    const id = active.id;
    if (id === undefined) return;
    setViewport((current) => {
      // Read-only use of the viewport: the pointer moves in screen units and
      // the node lives in graph units, so the delta has to be divided by scale
      // or a dragged node drifts away from the cursor when zoomed.
      const delta = toGraphDelta(current, dx, dy);
      setMoved((positions) => {
        const next = new Map(positions);
        const at = next.get(id) ?? { x: 0, y: 0 };
        next.set(id, { x: at.x + delta.x, y: at.y + delta.y });
        return next;
      });
      return current;
    });
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>): void => {
    gesture.current = undefined;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>): void => {
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    if (bounds.width === 0) return;

    // The wheel arrives in screen pixels; the anchor has to be in SVG units or
    // the point under the cursor will not be the point that stays put.
    const unit = VIEW.width / bounds.width;
    const at = {
      x: (event.clientX - bounds.left) * unit,
      y: (event.clientY - bounds.top) * unit,
    };

    setViewport((current) => zoomAt(current, event.deltaY < 0 ? 1.1 : 1 / 1.1, at));
  }, []);

  return {
    viewport,
    moved,
    reset,
    zoom,
    panning,
    beginNodeDrag,
    svgProps: { onPointerDown, onPointerMove, onPointerUp, onWheel },
  };
}

/** A rounded box with a title and up to three lines. */
function GraphNode(props: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  title: string;
  badge?: string;
  badgeTone?: string;
  lines: readonly string[];
  selected: boolean;
  live?: boolean;
  onSelect: () => void;
  onDragStart?: (event: ReactPointerEvent) => void;
}): ReactNode {
  const width = props.width ?? NODE.width;
  const height = props.height ?? NODE.height;

  return (
    <g
      className={`gnode ${props.selected ? "selected" : ""} ${props.live === true ? "live" : ""}`}
      transform={`translate(${props.x - width / 2}, ${props.y - height / 2})`}
      onClick={props.onSelect}
      // The node claims the gesture before the background does, so dragging a
      // box moves the box rather than the whole picture.
      onPointerDown={props.onDragStart}
      role="button"
      tabIndex={0}
      // The pulse is a colour and a stroke, so it is also stated in words —
      // movement alone is not something every reader perceives.
      aria-label={`${props.title}${props.badge === undefined ? "" : `, ${props.badge}`}${
        props.live === true ? ", active now" : ""
      }`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") props.onSelect();
      }}
    >
      <rect width={width} height={height} rx={8} />
      <text className="gnode-title" x={12} y={22}>
        {props.title}
      </text>
      {props.badge !== undefined && (
        <text className={`gnode-badge ${props.badgeTone ?? ""}`} x={width - 12} y={22}>
          {props.badge}
        </text>
      )}
      {props.lines.slice(0, 3).map((line, index) => (
        <text className="gnode-line" key={line} x={12} y={44 + index * 16}>
          {line}
        </text>
      ))}
    </g>
  );
}

/**
 * A connection between two nodes.
 *
 * Direction is carried by an arrowhead and by the label, never by colour alone
 * — §6 of the spec, and the reason the states below also read as words.
 */
function Edge(props: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  label?: string;
  dashed?: boolean;
  live?: boolean;
}): ReactNode {
  const midX = (props.from.x + props.to.x) / 2;
  const midY = (props.from.y + props.to.y) / 2;

  return (
    <g
      className={`gedge ${props.dashed === true ? "idle" : ""} ${
        props.live === true ? "live" : ""
      }`}
    >
      <line
        x1={props.from.x}
        y1={props.from.y}
        x2={props.to.x}
        y2={props.to.y}
        markerEnd="url(#arrow)"
      />
      {props.label !== undefined && (
        <text className="gedge-label" x={midX} y={midY - 6}>
          {props.label}
        </text>
      )}
    </g>
  );
}

function tokens(value: number | null): string {
  return value === null ? "unknown" : value.toLocaleString();
}

export function EngineeringGraph(): ReactNode {
  const { data, error, loading, refresh } = useApi(() => api.graph());
  const [selected, setSelected] = useState<string>("core");
  const { active, streaming } = useLiveGraph(refresh);
  const { viewport, moved, reset, zoom, panning, beginNodeDrag, svgProps } =
    useGraphInteraction();

  const workerCount = data?.workers.length ?? 0;
  const [expanded, setExpanded] = useState<boolean | undefined>(undefined);
  // Collapsed by default past the threshold, but only until the developer says
  // otherwise — an explicit choice outranks the default and is never reset by
  // a live refresh changing the count.
  const showWorkers = expanded ?? workerCount <= COLLAPSE_ABOVE;

  const visibleWorkers = data === undefined ? [] : showWorkers ? data.workers : [];
  const height = requiredHeight(visibleWorkers.length);
  const drop = coreOffset(visibleWorkers.length);

  /** A placed node, shifted by however far the developer dragged it. */
  const at = (placed: Placed): Placed => {
    const offset = moved.get(placed.id);
    return offset === undefined
      ? placed
      : { id: placed.id, x: placed.x + offset.x, y: placed.y + offset.y };
  };

  const fixed = (id: string, x: number, y: number): Placed => at({ id, x, y });

  const placedWorkers = placeWorkers(visibleWorkers.map((worker) => worker.id)).map(at);
  const core = fixed("core", CORE.x, CORE.y + drop);
  const memory = fixed("memory", 150 + NODE.width / 2, 480 + drop);
  const repository = fixed("repository", 750 - NODE.width / 2, 480 + drop);
  const verification = fixed("verification", CORE.x, 560 - NODE.height / 2 + drop);
  const cluster = fixed("workers", VIEW.width / 2, 80);

  return (
    <>
      <h1>Graph</h1>
      <p className="subtitle">
        Everything reaches a worker through ctxd. Click a node for detail, drag to move
        it, drag the background to pan, scroll to zoom.{" "}
        {/* Whether the picture is live is itself a fact the reader needs: a
            still graph and a broken stream look identical otherwise. */}
        {streaming === true
          ? "Live — nodes light up as events arrive."
          : streaming === false
            ? "Stream lost — this is the last state ctxd reported, not the current one."
            : "Connecting to the event stream…"}
      </p>

      <Panel loading={loading} error={error}>
        {data !== undefined && (
          <>
            <div className="toolbar">
              <button className="button" onClick={() => zoom(1.2)} aria-label="Zoom in">
                +
              </button>
              <button className="button" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">
                −
              </button>
              <button className="button" onClick={reset}>
                Reset view
              </button>
              {workerCount > 0 && (
                <button
                  className="button"
                  aria-pressed={showWorkers}
                  onClick={() => setExpanded(!showWorkers)}
                >
                  {showWorkers
                    ? `Collapse ${workerCount} worker${workerCount === 1 ? "" : "s"}`
                    : `Expand ${workerCount} worker${workerCount === 1 ? "" : "s"}`}
                </button>
              )}
              <span className="reason">{Math.round(viewport.scale * 100)}%</span>
            </div>

            <svg
              className={`graph ${panning ? "panning" : ""}`}
              viewBox={`0 0 ${VIEW.width} ${height}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="ctxd engineering graph"
              {...svgProps}
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX={9}
                  refY={5}
                  markerWidth={6}
                  markerHeight={6}
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>

              {/* One transform for the whole scene: pan and zoom move the
                  picture, never the model behind it. */}
              <g transform={transformOf(viewport)}>
              {/* Edges first, so nodes paint over the line ends. */}
              {placedWorkers.map((placed) => (
                <Edge
                  key={placed.id}
                  from={{ x: placed.x, y: placed.y + NODE.height / 2 }}
                  to={{ x: core.x, y: core.y - CORE.height / 2 }}
                  dashed={
                    data.workers.find((worker) => worker.id === placed.id)?.connection !==
                    "connected"
                  }
                  live={active.has(workerEdgeKey(placed.id))}
                />
              ))}

              {!showWorkers && workerCount > 0 && (
                <Edge
                  from={{ x: cluster.x, y: cluster.y + NODE.height / 2 }}
                  to={{ x: core.x, y: core.y - CORE.height / 2 }}
                  dashed={data.core.workersAttached === 0}
                  live={data.workers.some((worker) =>
                    active.has(workerEdgeKey(worker.claimedName)),
                  )}
                />
              )}

              <Edge
                from={{ x: core.x - CORE.width / 2, y: core.y }}
                to={{ x: memory.x, y: memory.y }}
                label="retrieve"
                live={active.has(EDGE_MEMORY)}
              />
              <Edge
                from={{ x: core.x + CORE.width / 2, y: core.y }}
                to={{ x: repository.x, y: repository.y }}
                label="inspect"
                live={active.has(EDGE_REPOSITORY)}
              />
              <Edge
                from={{ x: core.x, y: core.y + CORE.height / 2 }}
                to={{ x: verification.x, y: verification.y }}
                label="verify"
                live={active.has(EDGE_VERIFICATION)}
              />

              {placedWorkers.map((placed) => {
                const worker = data.workers.find((entry) => entry.id === placed.id);
                if (worker === undefined) return null;
                return (
                  <GraphNode
                    key={worker.id}
                    x={placed.x}
                    y={placed.y}
                    title={worker.claimedName}
                    badge={worker.connection}
                    badgeTone={tone(worker.connection)}
                    lines={[
                      "claims this name",
                      worker.since === null ? "never seen" : formatTime(worker.since),
                    ]}
                    selected={selected === worker.id}
                    live={active.has(workerKey(worker.claimedName))}
                    onSelect={() => setSelected(worker.id)}
                    onDragStart={(event) => beginNodeDrag(worker.id, event)}
                  />
                );
              })}

              {!showWorkers && workerCount > 0 && (
                <GraphNode
                  x={cluster.x}
                  y={cluster.y}
                  title={`${workerCount} workers`}
                  badge={`${data.core.workersAttached} attached`}
                  badgeTone={data.core.workersAttached > 0 ? "ok" : "muted"}
                  // Collapsed hides the boxes, never the facts: the totals are
                  // still stated, so the summary cannot read as "nothing here".
                  lines={["collapsed — expand to see each", "all names are claims"]}
                  selected={selected === "workers"}
                  live={data.workers.some((worker) =>
                    active.has(workerKey(worker.claimedName)),
                  )}
                  onSelect={() => setSelected("workers")}
                  onDragStart={(event) => beginNodeDrag("workers", event)}
                />
              )}

              <GraphNode
                x={core.x}
                y={core.y}
                width={CORE.width}
                height={CORE.height}
                title="ctxd core"
                badge={data.core.mode}
                lines={[
                  `context  ${tokens(data.context.candidateTokens)} → ${tokens(data.context.finalTokens)}`,
                  `memory   ${data.memory.total.toLocaleString()}`,
                  `tasks    ${data.tasks.inProgress} of ${data.tasks.total} in progress`,
                ]}
                selected={selected === "core"}
                live={active.has(CORE_KEY)}
                onSelect={() => setSelected("core")}
                onDragStart={(event) => beginNodeDrag("core", event)}
              />

              <GraphNode
                x={memory.x}
                y={memory.y}
                title="Memory"
                badge={String(data.memory.total)}
                lines={Object.entries(data.memory.byType)
                  .slice(0, 3)
                  .map(([type, count]) => `${type}  ${count}`)}
                selected={selected === "memory"}
                live={active.has(MEMORY_KEY)}
                onSelect={() => setSelected("memory")}
                onDragStart={(event) => beginNodeDrag("memory", event)}
              />

              <GraphNode
                x={repository.x}
                y={repository.y}
                title="Repository"
                lines={[data.repository.git]}
                selected={selected === "repository"}
                live={active.has(REPOSITORY_KEY)}
                onSelect={() => setSelected("repository")}
                onDragStart={(event) => beginNodeDrag("repository", event)}
              />

              <GraphNode
                x={verification.x}
                y={verification.y}
                title="Verification"
                // A stale PASS is never badged as a PASS. The status is real,
                // but it describes a tree that no longer exists, and the badge
                // is the part a developer reads at a glance (UI-8).
                badge={
                  data.verification.freshness === "stale"
                    ? `${data.verification.status} — stale`
                    : data.verification.status
                }
                badgeTone={
                  data.verification.freshness === "stale"
                    ? "warn"
                    : tone(data.verification.status)
                }
                lines={[
                  data.verification.at === null
                    ? "never run"
                    : `as of ${formatTime(data.verification.at)}`,
                  data.verification.freshness === "stale"
                    ? `tree changed since${
                        data.verification.changedSince === null
                          ? ""
                          : `: ${data.verification.changedSince}`
                      }`
                    : data.verification.freshness === "unknown" &&
                        data.verification.at !== null
                      ? "freshness unknown"
                      : "",
                ].filter((line) => line !== "")}
                selected={selected === "verification"}
                live={active.has(VERIFICATION_KEY)}
                onSelect={() => setSelected("verification")}
                onDragStart={(event) => beginNodeDrag("verification", event)}
              />
              </g>
            </svg>

            <NodeDetail graph={data} selected={selected} showWorkers={showWorkers} />
          </>
        )}
      </Panel>
    </>
  );
}

/** What the selected node actually knows, in words rather than in a box. */
function NodeDetail(props: {
  graph: CtxdGraph;
  selected: string;
  showWorkers: boolean;
}): ReactNode {
  const { graph, selected } = props;

  if (selected === "workers") {
    return (
      <div className="card">
        <strong>
          {graph.workers.length} worker{graph.workers.length === 1 ? "" : "s"}
        </strong>
        <div className="reason">
          {graph.core.workersAttached} attached, {graph.core.workersKnown} known to this
          project
        </div>
        {/* Collapsing hides boxes, not facts. Every worker is still listed by
            name and state, and every name is still marked as a claim (§6). */}
        <div className="reason">
          {graph.workers
            .map((worker) => `${worker.claimedName} (${worker.connection})`)
            .join(" · ")}
        </div>
        <div className="reason">
          These names are self-declared. ctxd observes that a client attached, never which
          one.
        </div>
      </div>
    );
  }

  if (selected === "core") {
    return (
      <div className="card">
        <strong>ctxd core</strong>
        <div className="reason">
          v{graph.core.version} · {graph.core.mode} · {graph.core.dir}
        </div>
        <div className="reason">
          {graph.core.workersAttached} of {graph.core.workersKnown} known workers attached
        </div>
      </div>
    );
  }

  if (selected === "memory") {
    return (
      <div className="card">
        <strong>Memory</strong>
        <div className="reason">
          {graph.memory.total.toLocaleString()} live memories, archived ones excluded
        </div>
        <div className="reason">
          {Object.entries(graph.memory.byType)
            .map(([type, count]) => `${type} ${count}`)
            .join(" · ") || "nothing recorded yet"}
        </div>
      </div>
    );
  }

  if (selected === "repository") {
    return (
      <div className="card">
        <strong>Repository</strong>
        <div className="reason">{graph.repository.dir}</div>
        <div className="reason">{graph.repository.git}</div>
      </div>
    );
  }

  if (selected === "verification") {
    return (
      <div className="card">
        <div className="row-head">
          <strong>Verification</strong>
          {graph.verification.at !== null && (
            <span
              className={`tag ${
                graph.verification.freshness === "current"
                  ? "ok"
                  : graph.verification.freshness === "stale"
                    ? "warn"
                    : ""
              }`}
            >
              {graph.verification.freshness}
            </span>
          )}
        </div>
        <div className="reason">
          {graph.verification.source === "none"
            ? "no verification has been recorded for this project"
            : /* The status is from the newest Change Receipt, so it describes
                 the tree as it was then. Stating the time is what stops it
                 reading as a claim about the tree right now (§21). */
              `${graph.verification.status} as of ${formatTime(graph.verification.at ?? "")} — from the last Change Receipt, not a live run`}
        </div>
        {/* Why ctxd thinks what it thinks, so the verdict can be argued with
            rather than merely believed. */}
        <div className="reason">{graph.verification.reason}</div>
        {graph.verification.freshness === "stale" && (
          <div className="reason">Run ctxd verify to get a result for the current tree.</div>
        )}
      </div>
    );
  }

  const worker = graph.workers.find((entry) => entry.id === selected);
  if (worker === undefined) return null;

  return (
    <div className="card">
      <strong>{worker.claimedName}</strong>
      <div className="reason">
        {/* The name is configuration, not identification (§6). */}
        connection {worker.connection} — this name is self-declared and ctxd cannot verify it
      </div>
      <div className="reason">
        {worker.since === null
          ? "no connection events recorded"
          : `since ${formatTime(worker.since)}${
              worker.openEnded ? " — no disconnect recorded" : ""
            }`}
      </div>
    </div>
  );
}
