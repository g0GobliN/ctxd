import type { Config, CtxdPaths } from "@ctxd/core";
import type { Db } from "@ctxd/db";

export interface RouteContext {
  readonly db: Db;
  readonly paths: CtxdPaths;
  readonly config: Config;
  /** Directory the UI is inspecting; defaults to the process working directory. */
  readonly dir: string;
}
