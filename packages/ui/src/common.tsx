/** Small shared pieces. Kept together because each is a few lines. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "./api.js";

/**
 * Load data from the API, tracking loading and error state.
 *
 * Errors are surfaced rather than swallowed: a panel that silently shows
 * nothing is indistinguishable from a panel with nothing to show, and ctxd's
 * whole premise is that absence should be explained.
 *
 * Two ways to fetch again. `reload` is the one a person triggers, and shows
 * the loading state because they are waiting for it. `refresh` is the one an
 * event triggers, and does not: a panel that blanked every time a worker made
 * a tool call would be unreadable exactly when there was most to read. A
 * failure still replaces the view either way — a stale graph presented as a
 * current one is the failure this project cannot afford (§37).
 */
export function useApi<T>(load: () => Promise<T>, deps: readonly unknown[] = []): {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
  refresh: () => void;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // Read and cleared by the effect below, so it describes the fetch it
  // triggered rather than whichever fetch happens to be in flight.
  const quiet = useRef(false);

  const reload = useCallback(() => {
    quiet.current = false;
    setNonce((value) => value + 1);
  }, []);

  const refresh = useCallback(() => {
    quiet.current = true;
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const silent = quiet.current;
    quiet.current = false;
    if (!silent) setLoading(true);

    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(undefined);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setData(undefined);
        setError(cause instanceof ApiError ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled && !silent) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  return { data, error, loading, reload, refresh };
}

export function Panel(props: {
  loading: boolean;
  error: string | undefined;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}): ReactNode {
  if (props.loading) return <div className="empty">Loading…</div>;
  if (props.error !== undefined) return <div className="error">{props.error}</div>;
  if (props.empty === true) {
    return <div className="empty">{props.emptyMessage ?? "Nothing here yet."}</div>;
  }
  return props.children;
}

export function Stat(props: { label: string; value: string | number; note?: string }): ReactNode {
  return (
    <div className="card stat">
      <div className="label">{props.label}</div>
      <div className="value">
        {typeof props.value === "number" ? props.value.toLocaleString() : props.value}
      </div>
      {props.note !== undefined && <div className="note">{props.note}</div>}
    </div>
  );
}

/** Colour a verdict by how much attention it needs. */
export function verdictTone(verdict: string): string {
  switch (verdict) {
    case "FOCUSED":
    case "PASS":
      return "ok";
    case "ACCEPTABLE":
      return "";
    case "BROAD":
      return "warn";
    default:
      return "danger";
  }
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
