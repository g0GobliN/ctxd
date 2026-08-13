import type { NextFunction, Request, Response } from "express";
import { SessionStore } from "./session-store.js";
import { verifyAccessToken } from "./jwt.js";

/**
 * Authentication middleware.
 *
 * During the migration both credentials are accepted: a bearer JWT, or the
 * legacy session cookie. The session branch is removed once every client ships
 * the token flow.
 */
export function authenticate(sessions: SessionStore) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const authorization = request.header("authorization");

    if (authorization?.startsWith("Bearer ") === true) {
      const claims = verifyAccessToken(authorization.slice(7));
      if (claims === undefined) {
        response.status(401).send("invalid access token");
        return;
      }
      request.userId = claims.sub;
      next();
      return;
    }

    const sessionId = request.cookies["sid"];
    if (typeof sessionId !== "string") {
      response.status(401).send("not authenticated");
      return;
    }

    const session = await sessions.verify(sessionId);
    if (session === undefined) {
      response.status(401).send("session expired");
      return;
    }

    request.userId = session.userId;
    next();
  };
}
