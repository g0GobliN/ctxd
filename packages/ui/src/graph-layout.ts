/**
 * Graph geometry and viewport arithmetic (UI-9).
 *
 * Pure functions, apart from the drawing code, so the one property that
 * actually decides whether the graph is usable — nodes not landing on top of
 * one another — can be asserted rather than eyeballed. Eyeballing a layout at
 * two workers is exactly how a layout that breaks at twelve ships.
 *
 * Still no graph library (§5). Fixed positions with a wrapping row is a dozen
 * lines of arithmetic; a force simulation would be the largest dependency in
 * the repository, bought to solve a problem this screen does not have.
 */

/** The SVG coordinate space. Nodes are placed in it; the viewport maps it. */
export const VIEW = { width: 900, height: 620 } as const;
export const CORE = { x: 450, y: 300, width: 230, height: 150 } as const;
export const NODE = { width: 170, height: 92 } as const;

/** Gaps that keep adjacent boxes from touching. */
const COLUMN_GAP = 24;
const ROW_GAP = 22;

/** Where the worker rows start, and how far down they may grow. */
const WORKER_TOP = 80;

export interface Placed {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The box a placed node occupies, since positions are centres. */
export function boxOf(placed: Placed, width = NODE.width, height = NODE.height): Box {
  return { x: placed.x - width / 2, y: placed.y - height / 2, width, height };
}

export function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/**
 * How many workers fit on one row.
 *
 * At least one, always — a viewport narrower than a single node is a layout
 * problem to solve by scrolling, not by dividing by zero.
 */
export function workersPerRow(): number {
  return Math.max(1, Math.floor(VIEW.width / (NODE.width + COLUMN_GAP)));
}

/**
 * Place the worker nodes.
 *
 * Workers sit above the core because they are what feeds it. Two is the common
 * case, which is why a short row is centred rather than packed to the left —
 * but the count is not bounded by anything real, so the row wraps rather than
 * compressing spacing until the boxes overlap. A cramped-but-legible grid beats
 * an even spread of unreadable boxes.
 */
export function placeWorkers(ids: readonly string[]): Placed[] {
  if (ids.length === 0) return [];

  const perRow = workersPerRow();
  const spacing = NODE.width + COLUMN_GAP;

  return ids.map((id, index) => {
    const row = Math.floor(index / perRow);
    const column = index % perRow;

    // Each row is centred on its own contents, so a trailing half-row sits
    // under the middle of the one above rather than hanging off to the left.
    const inThisRow = Math.min(perRow, ids.length - row * perRow);
    const rowWidth = spacing * (inThisRow - 1);
    const startX = VIEW.width / 2 - rowWidth / 2;

    return {
      id,
      x: startX + column * spacing,
      y: WORKER_TOP + row * (NODE.height + ROW_GAP),
    };
  });
}

/**
 * How far down the worker rows reach.
 *
 * The SVG grows rather than letting rows run into the core: with enough workers
 * the picture is taller, which a viewport can pan, instead of overlapping,
 * which nothing can fix.
 */
export function requiredHeight(workerCount: number): number {
  if (workerCount === 0) return VIEW.height;

  const rows = Math.ceil(workerCount / workersPerRow());
  const workersBottom = WORKER_TOP + (rows - 1) * (NODE.height + ROW_GAP) + NODE.height / 2;
  const clearance = workersBottom + ROW_GAP * 2 - (CORE.y - CORE.height / 2);

  return clearance <= 0 ? VIEW.height : VIEW.height + clearance;
}

/** Vertical offset applied to everything below the workers when rows wrap. */
export function coreOffset(workerCount: number): number {
  return requiredHeight(workerCount) - VIEW.height;
}

/* Viewport ------------------------------------------------------------------ */

export interface Viewport {
  /** Pan, in SVG units. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const IDENTITY: Viewport = { x: 0, y: 0, scale: 1 };

/**
 * Zoom limits.
 *
 * Bounded in both directions because neither extreme is recoverable by the
 * gesture that caused it: zoomed far enough out the nodes are unclickable, and
 * far enough in there is nothing on screen to aim at.
 */
export const MIN_SCALE = 0.4;
export const MAX_SCALE = 3;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Zoom about a fixed point.
 *
 * The point under the cursor stays under the cursor — the property that makes
 * wheel zoom feel like zooming rather than like the diagram sliding away.
 */
export function zoomAt(viewport: Viewport, factor: number, at: { x: number; y: number }): Viewport {
  const scale = clampScale(viewport.scale * factor);
  if (scale === viewport.scale) return viewport;

  const ratio = scale / viewport.scale;
  return {
    scale,
    x: at.x - (at.x - viewport.x) * ratio,
    y: at.y - (at.y - viewport.y) * ratio,
  };
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

/** Screen delta → SVG delta. Dragging must track the pointer at any zoom. */
export function toGraphDelta(viewport: Viewport, dx: number, dy: number): { x: number; y: number } {
  return { x: dx / viewport.scale, y: dy / viewport.scale };
}

export function transformOf(viewport: Viewport): string {
  return `translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`;
}
