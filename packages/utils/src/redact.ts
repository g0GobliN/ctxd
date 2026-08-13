/**
 * Keys whose values must never reach a log file, a receipt, or a worker.
 * Matched case-insensitively against object keys.
 */
export const SECRET_KEY_PATTERN =
  /(pass(word)?|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|credential|authorization|auth|session[-_]?id|cookie|bearer|dsn|connection[-_]?string)/i;

const REDACTED = "[redacted]";
const MAX_DEPTH = 8;

/**
 * Recursively replace secret-looking values with `[redacted]`.
 *
 * This is a defence in depth measure: ctxd should not collect secrets in the
 * first place (see the ignore rules in candidate collection), but anything
 * that does reach the logger is scrubbed here.
 */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY_PATTERN.test(key)
      ? REDACTED
      : redactSecrets(entry, depth + 1);
  }
  return out;
}
