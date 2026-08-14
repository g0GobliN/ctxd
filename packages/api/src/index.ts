export {
  ensureToken,
  isAllowedHost,
  isAllowedOrigin,
  TOKEN_FILE,
  tokenFrom,
  tokensMatch,
} from "./auth.js";

export {
  HttpError,
  MAX_BODY_BYTES,
  optionalInt,
  optionalString,
  readJsonBody,
  requireString,
  sendJson,
  type Route,
  type RouteHandler,
  type RouteRequest,
  type StreamHandler,
  type StreamSubscription,
} from "./http.js";

export { createRoutes } from "./routes.js";
export type { RouteContext } from "./context.js";
export { createEventRoutes, MAX_SUBSCRIBERS } from "./events.js";
export { projectIdFor } from "./project-scope.js";

export {
  defaultUiRoot,
  resolveAsset,
  serveStatic,
  type StaticResult,
} from "./static.js";

export {
  DEFAULT_HOST,
  DEFAULT_PORT,
  startApiServer,
  type ApiServer,
  type ApiServerOptions,
} from "./server.js";
