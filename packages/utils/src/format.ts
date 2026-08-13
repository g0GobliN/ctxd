/** Render a single check line, e.g. `✓ SQLite` or `✗ Node 24+`. */
export function formatCheck(ok: boolean, label: string, detail?: string): string {
  const mark = ok ? "✓" : "✗";
  return detail ? `${mark} ${label}  ${detail}` : `${mark} ${label}`;
}

/** Render aligned `key: value` lines for `ctxd status`. */
export function formatKeyValue(pairs: readonly (readonly [string, string])[]): string {
  const width = pairs.reduce((max, [key]) => Math.max(max, key.length), 0);
  return pairs
    .map(([key, value]) => `${key.padEnd(width)}  ${value}`)
    .join("\n");
}
