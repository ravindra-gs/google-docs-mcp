#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getDocument, listDocuments } from "./tools/docs.js";
import { getSpreadsheet, getSheetData, listSpreadsheets } from "./tools/sheets.js";
import { getOAuthInstance } from "./auth/oauth.js";

const DEFAULT_PORT = 12333;

type TransportType = "http" | "stdio";

function parseArgs(): { transport: TransportType; port: number } {
  const args = process.argv.slice(2);
  let transport: TransportType = "http";

  for (const arg of args) {
    if (arg === "--stdio") {
      transport = "stdio";
    } else if (arg === "--http") {
      transport = "http";
    }
  }

  const port = parseInt(process.env.MCP_PORT || process.env.PORT || "", 10) || DEFAULT_PORT;

  return { transport, port };
}

// Check authentication status
async function checkAuth(): Promise<boolean> {
  try {
    const oauth = getOAuthInstance();
    return await oauth.loadTokens();
  } catch {
    return false;
  }
}

// Create and configure MCP server
function createServer() {
  const server = new McpServer({
    name: "google-docs-mcp",
    version: "1.0.0",
  });

  // Register Google Docs tools
  server.tool(
    "get_document",
    "Get the full content of a Google Doc by its ID or URL",
    {
      documentId: z.string().describe("The document ID or full Google Docs URL"),
    },
    async ({ documentId }) => {
      const isAuth = await checkAuth();
      if (!isAuth) {
        return {
          content: [{ type: "text", text: 'Not authenticated. Please run "bun run auth" to authenticate with Google first.' }],
          isError: true,
        };
      }

      try {
        const doc = await getDocument(documentId);
        return {
          content: [{ type: "text", text: `# ${doc.title}\n\n${doc.body}` }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_documents",
    "List Google Docs accessible to the user, optionally filtered by search query",
    {
      limit: z.number().optional().default(10).describe("Maximum number of documents to return (default: 10)"),
      query: z.string().optional().describe("Optional search query to filter documents"),
    },
    async ({ limit, query }) => {
      const isAuth = await checkAuth();
      if (!isAuth) {
        return {
          content: [{ type: "text", text: 'Not authenticated. Please run "bun run auth" to authenticate with Google first.' }],
          isError: true,
        };
      }

      try {
        const docs = await listDocuments(limit, query);
        if (docs.length === 0) {
          return { content: [{ type: "text", text: "No documents found." }] };
        }

        const formatted = docs
          .map((doc) => `- **${doc.name}**\n  ID: ${doc.id}\n  Modified: ${doc.modifiedTime || "Unknown"}\n  URL: ${doc.webViewLink || "N/A"}`)
          .join("\n\n");

        return { content: [{ type: "text", text: `Found ${docs.length} document(s):\n\n${formatted}` }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_spreadsheet",
    "Get metadata about a Google Spreadsheet including its sheets",
    {
      spreadsheetId: z.string().describe("The spreadsheet ID or full Google Sheets URL"),
    },
    async ({ spreadsheetId }) => {
      const isAuth = await checkAuth();
      if (!isAuth) {
        return {
          content: [{ type: "text", text: 'Not authenticated. Please run "bun run auth" to authenticate with Google first.' }],
          isError: true,
        };
      }

      try {
        const spreadsheet = await getSpreadsheet(spreadsheetId);
        const sheetsInfo = spreadsheet.sheets
          .map((sheet) => `  - ${sheet.title} (${sheet.rowCount || "?"} rows x ${sheet.columnCount || "?"} cols)`)
          .join("\n");

        return {
          content: [{ type: "text", text: `# ${spreadsheet.name}\n\nID: ${spreadsheet.id}\nURL: ${spreadsheet.webViewLink || "N/A"}\n\n## Sheets:\n${sheetsInfo}` }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_sheet_data",
    "Read data from a specific range in a Google Spreadsheet",
    {
      spreadsheetId: z.string().describe("The spreadsheet ID or full Google Sheets URL"),
      range: z.string().describe("The A1 notation range to read (e.g., 'Sheet1!A1:D10' or 'A1:D10')"),
    },
    async ({ spreadsheetId, range }) => {
      const isAuth = await checkAuth();
      if (!isAuth) {
        return {
          content: [{ type: "text", text: 'Not authenticated. Please run "bun run auth" to authenticate with Google first.' }],
          isError: true,
        };
      }

      try {
        const data = await getSheetData(spreadsheetId, range);
        if (data.values.length === 0) {
          return { content: [{ type: "text", text: "No data found in the specified range." }] };
        }

        const table = data.values.map((row) => row.join("\t")).join("\n");
        return { content: [{ type: "text", text: `Data from ${data.range}:\n\n${table}` }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_spreadsheets",
    "List Google Spreadsheets accessible to the user, optionally filtered by search query",
    {
      limit: z.number().optional().default(10).describe("Maximum number of spreadsheets to return (default: 10)"),
      query: z.string().optional().describe("Optional search query to filter spreadsheets"),
    },
    async ({ limit, query }) => {
      const isAuth = await checkAuth();
      if (!isAuth) {
        return {
          content: [{ type: "text", text: 'Not authenticated. Please run "bun run auth" to authenticate with Google first.' }],
          isError: true,
        };
      }

      try {
        const sheets = await listSpreadsheets(limit, query);
        if (sheets.length === 0) {
          return { content: [{ type: "text", text: "No spreadsheets found." }] };
        }

        const formatted = sheets
          .map((sheet) => `- **${sheet.name}**\n  ID: ${sheet.id}\n  Modified: ${sheet.modifiedTime || "Unknown"}\n  URL: ${sheet.webViewLink || "N/A"}`)
          .join("\n\n");

        return { content: [{ type: "text", text: `Found ${sheets.length} spreadsheet(s):\n\n${formatted}` }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  return server;
}

// Start with stdio transport
async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Docs MCP server started (stdio)");
}

// Start with HTTP transport (JSON-RPC over HTTP)
async function startHttp(port: number) {
  const server = createServer();

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // Health check
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Info endpoint
      if (url.pathname === "/" && req.method === "GET") {
        return new Response(
          JSON.stringify({
            name: "google-docs-mcp",
            version: "1.0.0",
            transport: "http",
            endpoints: { rpc: "/rpc", health: "/health" },
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // JSON-RPC endpoint
      if (url.pathname === "/rpc" && req.method === "POST") {
        try {
          const body = await req.json();

          // Handle MCP JSON-RPC requests
          const result = await handleJsonRpc(server, body);

          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message }, id: null }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Google Docs MCP server started (http)`);
  console.log(`Listening on http://localhost:${port}`);
  console.log(`RPC endpoint: POST http://localhost:${port}/rpc`);
  console.log(`Health check: GET http://localhost:${port}/health`);
}

// Simple JSON-RPC handler
async function handleJsonRpc(server: McpServer, request: any): Promise<any> {
  const { jsonrpc, method, params, id } = request;

  if (jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", error: { code: -32600, message: "Invalid JSON-RPC version" }, id };
  }

  try {
    // Handle initialize
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "google-docs-mcp", version: "1.0.0" },
        },
        id,
      };
    }

    // Handle tools/list
    if (method === "tools/list") {
      const tools = [
        {
          name: "get_document",
          description: "Get the full content of a Google Doc by its ID or URL",
          inputSchema: {
            type: "object",
            properties: { documentId: { type: "string", description: "The document ID or full Google Docs URL" } },
            required: ["documentId"],
          },
        },
        {
          name: "list_documents",
          description: "List Google Docs accessible to the user, optionally filtered by search query",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Maximum number of documents to return (default: 10)" },
              query: { type: "string", description: "Optional search query to filter documents" },
            },
          },
        },
        {
          name: "get_spreadsheet",
          description: "Get metadata about a Google Spreadsheet including its sheets",
          inputSchema: {
            type: "object",
            properties: { spreadsheetId: { type: "string", description: "The spreadsheet ID or full Google Sheets URL" } },
            required: ["spreadsheetId"],
          },
        },
        {
          name: "get_sheet_data",
          description: "Read data from a specific range in a Google Spreadsheet",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetId: { type: "string", description: "The spreadsheet ID or full Google Sheets URL" },
              range: { type: "string", description: "The A1 notation range to read (e.g., 'Sheet1!A1:D10')" },
            },
            required: ["spreadsheetId", "range"],
          },
        },
        {
          name: "list_spreadsheets",
          description: "List Google Spreadsheets accessible to the user, optionally filtered by search query",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Maximum number of spreadsheets to return (default: 10)" },
              query: { type: "string", description: "Optional search query to filter spreadsheets" },
            },
          },
        },
      ];
      return { jsonrpc: "2.0", result: { tools }, id };
    }

    // Handle tools/call
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      let result;

      const isAuth = await checkAuth();
      if (!isAuth) {
        return {
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: 'Not authenticated. Please run "bun run auth" to authenticate with Google first.' }],
            isError: true,
          },
          id,
        };
      }

      try {
        switch (name) {
          case "get_document": {
            const doc = await getDocument(args.documentId);
            result = { content: [{ type: "text", text: `# ${doc.title}\n\n${doc.body}` }] };
            break;
          }
          case "list_documents": {
            const docs = await listDocuments(args.limit || 10, args.query);
            if (docs.length === 0) {
              result = { content: [{ type: "text", text: "No documents found." }] };
            } else {
              const formatted = docs
                .map((doc) => `- **${doc.name}**\n  ID: ${doc.id}\n  Modified: ${doc.modifiedTime || "Unknown"}\n  URL: ${doc.webViewLink || "N/A"}`)
                .join("\n\n");
              result = { content: [{ type: "text", text: `Found ${docs.length} document(s):\n\n${formatted}` }] };
            }
            break;
          }
          case "get_spreadsheet": {
            const spreadsheet = await getSpreadsheet(args.spreadsheetId);
            const sheetsInfo = spreadsheet.sheets
              .map((sheet) => `  - ${sheet.title} (${sheet.rowCount || "?"} rows x ${sheet.columnCount || "?"} cols)`)
              .join("\n");
            result = {
              content: [{ type: "text", text: `# ${spreadsheet.name}\n\nID: ${spreadsheet.id}\nURL: ${spreadsheet.webViewLink || "N/A"}\n\n## Sheets:\n${sheetsInfo}` }],
            };
            break;
          }
          case "get_sheet_data": {
            const data = await getSheetData(args.spreadsheetId, args.range);
            if (data.values.length === 0) {
              result = { content: [{ type: "text", text: "No data found in the specified range." }] };
            } else {
              const table = data.values.map((row) => row.join("\t")).join("\n");
              result = { content: [{ type: "text", text: `Data from ${data.range}:\n\n${table}` }] };
            }
            break;
          }
          case "list_spreadsheets": {
            const sheets = await listSpreadsheets(args.limit || 10, args.query);
            if (sheets.length === 0) {
              result = { content: [{ type: "text", text: "No spreadsheets found." }] };
            } else {
              const formatted = sheets
                .map((sheet) => `- **${sheet.name}**\n  ID: ${sheet.id}\n  Modified: ${sheet.modifiedTime || "Unknown"}\n  URL: ${sheet.webViewLink || "N/A"}`)
                .join("\n\n");
              result = { content: [{ type: "text", text: `Found ${sheets.length} spreadsheet(s):\n\n${formatted}` }] };
            }
            break;
          }
          default:
            return { jsonrpc: "2.0", error: { code: -32601, message: `Unknown tool: ${name}` }, id };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }

      return { jsonrpc: "2.0", result, id };
    }

    return { jsonrpc: "2.0", error: { code: -32601, message: `Method not found: ${method}` }, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { jsonrpc: "2.0", error: { code: -32603, message }, id };
  }
}

// Main entry point
async function main() {
  const { transport, port } = parseArgs();

  if (transport === "stdio") {
    await startStdio();
  } else {
    await startHttp(port);
  }
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
