import { listProjects } from "@ctxd/project";
import { HttpError, type RouteRequest } from "./http.js";
import type { RouteContext } from "./context.js";

/**
 * Which project a request is about.
 *
 * An explicit `?project=` wins; otherwise the first registered project is used,
 * which is the single-project case almost every developer is in. With none
 * registered this is an error rather than an empty success, so the interface
 * says what to do instead of showing a convincing empty dashboard.
 */
export function projectIdFor(context: RouteContext, request: RouteRequest): string {
  const supplied = request.query.get("project");
  if (supplied !== null && supplied !== "") return supplied;

  const projects = listProjects(context.db);
  const first = projects[0];
  if (first === undefined) {
    throw new HttpError(404, "no project is registered — run: ctxd init");
  }
  return first.id;
}
