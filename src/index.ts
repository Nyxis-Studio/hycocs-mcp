#!/usr/bin/env node

/**
 * Hytale Documentation MCP Server
 *
 * A Model Context Protocol server that provides access to Hytale API documentation
 * using TypeScript and Streamable HTTP transport.
 */

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import cors from "cors";
import logger from "./utils/logger.js";
import { loadConfig } from "./utils/config.js";
import {
  mcpConnectionsTotal,
  mcpActiveConnections,
  initMetricsPush,
  stopMetricsPush,
} from "./utils/metrics.js";
import { searchHytaleClasses, readHytaleClassDocs } from "./tools/handlers.js";
import type {
  SearchHytaleClassesArgs,
  ReadHytaleClassDocsArgs,
} from "./types/index.js";

// Load configuration
const config = loadConfig();

// Create MCP Server
const mcpServer = new Server(
  {
    name: "hydocs-docs-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Tool list handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_hydocs_classes",
        description:
          "Search for Hytale API classes, interfaces, and enums by name. Returns a list of matching classes with their types.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to match against class names",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "read_hydocs_class_docs",
        description:
          "Read the full documentation for a specific Hytale API class, interface, or enum. Returns the complete markdown documentation.",
        inputSchema: {
          type: "object",
          properties: {
            full_class_name: {
              type: "string",
              description:
                "The full class name (e.g., 'com.hypixel.hydocs.example.ClassName')",
            },
          },
          required: ["full_class_name"],
        },
      },
    ],
  };
});

// Tool execution handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let content: string;

    switch (name) {
      case "search_hydocs_classes":
        content = await searchHytaleClasses(
          args as unknown as SearchHytaleClassesArgs,
          config.lookupFile
        );
        break;

      case "read_hydocs_class_docs":
        content = await readHytaleClassDocs(
          args as unknown as ReadHytaleClassDocsArgs,
          config.lookupFile,
          config.docsDir
        );
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Resources handler (empty for now)
mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: [] };
});

// Prompts handler (empty for now)
mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: [] };
});

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: process.env.npm_package_name,
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString(),
  });
});

// MCP Streamable HTTP endpoint
app.all("/mcp", async (req: Request, res: Response) => {
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  // Track connection metrics
  mcpConnectionsTotal.inc({ ip: clientIp });
  mcpActiveConnections.inc();

  logger.info("New MCP connection", {
    ip: clientIp,
    method: req.method,
    path: req.path,
  });

  // Track connection close
  res.on("close", () => {
    mcpActiveConnections.dec();
    logger.info("MCP connection closed", { ip: clientIp });
  });

  try {
    // Create transport for this request (stateless mode)
    const transport = new StreamableHTTPServerTransport();

    // Connect server to transport
    await mcpServer.connect(transport);

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    mcpActiveConnections.dec();
    logger.error("Failed to handle MCP request", {
      error: error instanceof Error ? error.message : String(error),
      ip: clientIp,
    });

    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Start server
let metricsInterval: NodeJS.Timeout | null = null;

app.listen(config.port, () => {
  logger.info("Hydocs MCP Server started", {
    port: config.port,
    endpoint: "/mcp",
    healthEndpoint: "/health",
    docsDir: config.docsDir,
  });

  // Initialize metrics push if enabled
  if (config.enableMetricsPush && config.pushgatewayUrl) {
    try {
      metricsInterval = initMetricsPush(config);
      logger.info("Metrics push enabled", {
        pushgatewayUrl: config.pushgatewayUrl,
        interval: config.metricsPushInterval,
      });
    } catch (error) {
      logger.error("Failed to initialize metrics push", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (config.enableMetricsPush && !config.pushgatewayUrl) {
    logger.warn("ENABLE_METRICS_PUSH is true but PUSHGATEWAY_URL is not set. Metrics push disabled.");
  }
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutdown signal received, cleaning up...");

  if (metricsInterval) {
    await stopMetricsPush(metricsInterval, config);
  }

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
