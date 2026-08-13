import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "@ctxd/core";
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

    try {
      const result = tool.handler((request.params.arguments ?? {}) as Record<string, unknown>);
      return {
        content: [{ type: "text" as const, text: result.text }],
        ...(result.isError === true ? { isError: true } : {}),
      };
    } catch (error) {
      // A failing tool must not take down the server: the worker gets an error
      // it can act on instead of a dropped connection.
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
  await server.connect(new StdioServerTransport());

  await new Promise<void>((resolve) => {
    server.onclose = () => resolve();
  });
}
