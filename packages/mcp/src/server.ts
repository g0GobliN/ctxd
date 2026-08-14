import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { VERSION } from "@ctxd/core";
import { detectProject, findProjectByRoot } from "@ctxd/project";
import { DEFAULT_RETENTION_DAYS, pruneEvents } from "@ctxd/events";
import { createEmitter } from "./events.js";
import { createTools, type ToolContext, type ToolDefinition } from "./tools.js";

export const SERVER_NAME = "ctxd";

/**
 * Build the MCP server.
 *
 * The protocol layer does nothing but dispatch: every tool calls the same core
 * services the CLI does. MCP is the bridge between ctxd and AI workers, not the
 * place where behaviour lives.
 */
export function createServer(ctx: ToolContext): { server: Server; tools: ToolDefinition[] } {
  const tools = createTools(ctx);
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  // Resolved once: every tool call would otherwise re-detect the project just
  // to record that it happened, which is more work than the work.
  const detected = detectProject(resolve(ctx.cwd));
  const events = createEmitter(ctx.db, findProjectByRoot(ctx.db, detected.root)?.id, ctx.worker);

  const server = new Server(
    { name: SERVER_NAME, version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const tool = byName.get(request.params.name);
    if (tool === undefined) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    // The tool name only. Arguments can carry a task description, a search
    // query or a path, and the event stream is readable by every local process.
    events.emit("worker_request_started", { data: { tool: tool.name } });

    try {
      const result = tool.handler((request.params.arguments ?? {}) as Record<string, unknown>);
      events.emit(result.isError === true ? "worker_error" : "worker_request_finished", {
        data: { tool: tool.name },
      });
      return {
        content: [{ type: "text" as const, text: result.text }],
        ...(result.isError === true ? { isError: true } : {}),
      };
    } catch (error) {
      // A failing tool must not take down the server: the worker gets an error
      // it can act on instead of a dropped connection.
      events.emit("worker_error", { data: { tool: tool.name } });
      return {
        content: [{ type: "text" as const, text: `ctxd: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  return { server, tools };
}

/**
 * Run the server on stdio until the transport closes.
 *
 * `connect()` resolves once the transport is attached, not when the session
 * ends, so this waits for the close event. Returning earlier would let the
 * caller tear down the database while the server was still serving requests.
 */
export async function runStdioServer(ctx: ToolContext): Promise<void> {
  const { server } = createServer(ctx);

  // The two connection facts this process can actually observe: a client
  // attached, and later it left (§6). Which client it is remains whatever the
  // developer configured — a claim, recorded as one.
  const detected = detectProject(resolve(ctx.cwd));
  const project = findProjectByRoot(ctx.db, detected.root);
  const events = createEmitter(ctx.db, project?.id, ctx.worker);

  // Once per session, at the one moment nothing is waiting on it. The log gains
  // rows with every tool call, and sessions, checkpoints and receipts are the
  // durable record of anything this old.
  try {
    const cutoff = new Date(Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    pruneEvents(ctx.db, cutoff);
  } catch {
    // Housekeeping. It must never stop the server from starting.
  }

  await server.connect(new StdioServerTransport());
  events.emit("worker_connected", { data: { transport: "stdio", version: VERSION } });

  await new Promise<void>((resolve) => {
    server.onclose = () => {
      events.emit("worker_disconnected", { data: { transport: "stdio" } });
      resolve();
    };
  });
}
