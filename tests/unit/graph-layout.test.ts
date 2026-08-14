import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  boxOf,
  clampScale,
  CORE,
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  NODE,
  overlaps,
  panBy,
  placeWorkers,
  requiredHeight,
  toGraphDelta,
  transformOf,
  VIEW,
  workersPerRow,
  zoomAt,
} from "../../packages/ui/src/graph-layout.ts";

/**
 * Graph layout and viewport (UI-9).
 *
 * The exit criterion is "usable with 10+ nodes", which sounds like something
 * only a human can judge — but the part that actually decides it is arithmetic:
 * boxes must not land on top of one another, and the gestures must behave.
 * Eyeballing a layout at two workers is exactly how a layout that breaks at
 * twelve gets shipped, so those properties are asserted here rather than
 * inspected once.
 */

const names = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `worker-${index}`);

/** Every pair of placed nodes, for overlap checking. */
function pairs<T>(items: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      out.push([items[i] as T, items[j] as T]);
    }
  }
  return out;
}

describe("graph layout (UI-9)", () => {
  it("places nothing when there are no workers", () => {
    assert.deepEqual(placeWorkers([]), []);
  });

  it("centres a short row rather than packing it left", () => {
    const [only] = placeWorkers(names(1));
    assert.equal(only?.x, VIEW.width / 2);

    const two = placeWorkers(names(2));
    const midpoint = ((two[0]?.x ?? 0) + (two[1]?.x ?? 0)) / 2;
    assert.equal(midpoint, VIEW.width / 2);
  });

  for (const count of [1, 2, 3, 5, 6, 8, 10, 12, 16, 24]) {
    it(`keeps ${count} worker node(s) from overlapping`, () => {
      const placed = placeWorkers(names(count));
      assert.equal(placed.length, count);

      for (const [a, b] of pairs(placed)) {
        assert.ok(
          !overlaps(boxOf(a), boxOf(b)),
          `${a.id} at (${a.x},${a.y}) overlaps ${b.id} at (${b.x},${b.y}) with ${count} workers`,
        );
      }
    });
  }

  it("wraps to a second row instead of compressing spacing", () => {
    const perRow = workersPerRow();
    const placed = placeWorkers(names(perRow + 1));

    const rows = new Set(placed.map((entry) => entry.y));
    // A cramped-but-legible grid beats an even spread of unreadable boxes.
    assert.equal(rows.size, 2);
  });

  it("grows the canvas rather than letting workers run into the core", () => {
    const placed = placeWorkers(names(20));
    const height = requiredHeight(20);

    const lowest = Math.max(...placed.map((entry) => entry.y));
    const coreTop = CORE.y + (height - VIEW.height) - CORE.height / 2;

    assert.ok(height > VIEW.height, "the canvas did not grow for 20 workers");
    assert.ok(
      lowest + NODE.height / 2 < coreTop,
      "the lowest worker row reaches the core box",
    );
  });

  it("leaves the canvas alone when everything already fits", () => {
    assert.equal(requiredHeight(0), VIEW.height);
    assert.equal(requiredHeight(2), VIEW.height);
  });

  it("keeps every node inside the horizontal canvas", () => {
    for (const count of [1, 4, 10, 24]) {
      for (const placed of placeWorkers(names(count))) {
        const box = boxOf(placed);
        assert.ok(box.x >= 0, `${placed.id} runs off the left edge at ${count} workers`);
        assert.ok(
          box.x + box.width <= VIEW.width,
          `${placed.id} runs off the right edge at ${count} workers`,
        );
      }
    }
  });
});

describe("graph viewport (UI-9)", () => {
  it("starts unchanged", () => {
    assert.deepEqual(IDENTITY, { x: 0, y: 0, scale: 1 });
    assert.equal(transformOf(IDENTITY), "translate(0, 0) scale(1)");
  });

  it("bounds zoom in both directions", () => {
    // Neither extreme is recoverable by the gesture that caused it: too far out
    // and the nodes are unclickable, too far in and there is nothing to aim at.
    assert.equal(clampScale(0.001), MIN_SCALE);
    assert.equal(clampScale(1000), MAX_SCALE);
    assert.equal(clampScale(1.5), 1.5);
  });

  it("keeps the point under the cursor under the cursor", () => {
    const at = { x: 300, y: 200 };
    const zoomed = zoomAt(IDENTITY, 2, at);

    // The graph coordinate beneath the anchor must be the same before and
    // after — that is the difference between zooming and the diagram sliding.
    const before = (at.x - IDENTITY.x) / IDENTITY.scale;
    const after = (at.x - zoomed.x) / zoomed.scale;
    assert.ok(Math.abs(before - after) < 1e-9);

    const beforeY = (at.y - IDENTITY.y) / IDENTITY.scale;
    const afterY = (at.y - zoomed.y) / zoomed.scale;
    assert.ok(Math.abs(beforeY - afterY) < 1e-9);
  });

  it("holds the anchor at the zoom limits too", () => {
    const at = { x: 120, y: 640 };
    let viewport = IDENTITY;
    for (let step = 0; step < 20; step += 1) viewport = zoomAt(viewport, 1.3, at);

    assert.equal(viewport.scale, MAX_SCALE);
    const before = (at.x - IDENTITY.x) / IDENTITY.scale;
    const after = (at.x - viewport.x) / viewport.scale;
    assert.ok(Math.abs(before - after) < 1e-6);
  });

  it("returns the same viewport when a zoom would change nothing", () => {
    const clamped = zoomAt({ x: 0, y: 0, scale: MAX_SCALE }, 2, { x: 0, y: 0 });
    // Identity is returned rather than a new object, so a wheel spin at the
    // limit does not re-render the graph on every notch.
    assert.equal(clamped.scale, MAX_SCALE);
    assert.equal(clamped.x, 0);
  });

  it("pans by exactly what it was given", () => {
    assert.deepEqual(panBy(IDENTITY, 40, -25), { x: 40, y: -25, scale: 1 });
  });

  it("scales a drag delta so a node tracks the pointer when zoomed", () => {
    // Screen pixels are not graph units once zoomed; without this division a
    // dragged node drifts away from the cursor.
    assert.deepEqual(toGraphDelta({ x: 0, y: 0, scale: 2 }, 10, 20), { x: 5, y: 10 });
    assert.deepEqual(toGraphDelta({ x: 0, y: 0, scale: 0.5 }, 10, 20), { x: 20, y: 40 });
  });
});
