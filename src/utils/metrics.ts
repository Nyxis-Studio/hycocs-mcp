/**
 * Prometheus metrics setup
 */

import promClient, { Pushgateway } from "prom-client";
import type { ServerConfig } from "../types/index.js";
import logger from "./logger.js";

// Create a Registry
export const register = new promClient.Registry();

// Enable default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom MCP metrics
export const mcpConnectionsTotal = new promClient.Counter({
  name: "mcp_connections_total",
  help: "Total number of MCP connections established",
  labelNames: ["ip"],
  registers: [register],
});

export const mcpToolCallsTotal = new promClient.Counter({
  name: "mcp_tool_calls_total",
  help: "Total number of MCP tool calls",
  labelNames: ["tool_name", "status"],
  registers: [register],
});

export const mcpToolDurationSeconds = new promClient.Histogram({
  name: "mcp_tool_duration_seconds",
  help: "Duration of MCP tool calls in seconds",
  labelNames: ["tool_name"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const mcpActiveConnections = new promClient.Gauge({
  name: "mcp_active_connections",
  help: "Number of currently active MCP connections",
  registers: [register],
});

/**
 * Initialize metrics push to Pushgateway
 * @param config Server configuration
 * @returns Interval handle for cleanup
 */
export function initMetricsPush(config: ServerConfig): NodeJS.Timeout {
  if (!config.pushgatewayUrl) {
    throw new Error("PUSHGATEWAY_URL is required for metrics push");
  }

  const pushgateway = new Pushgateway(config.pushgatewayUrl, [], register);

  const interval = setInterval(async () => {
    try {
      await pushgateway.pushAdd({ jobName: "hydocs-mcp" });
      logger.debug("Metrics pushed to Pushgateway");
    } catch (error) {
      logger.error("Failed to push metrics", {
        error: error instanceof Error ? error.message : String(error),
        pushgatewayUrl: config.pushgatewayUrl,
      });
    }
  }, config.metricsPushInterval);

  return interval;
}

/**
 * Stop metrics push and perform final push
 * @param interval Interval handle to clear
 * @param config Server configuration
 */
export async function stopMetricsPush(
  interval: NodeJS.Timeout,
  config: ServerConfig
): Promise<void> {
  clearInterval(interval);

  if (!config.pushgatewayUrl) {
    return;
  }

  try {
    const pushgateway = new Pushgateway(config.pushgatewayUrl, [], register);
    await pushgateway.pushAdd({ jobName: "hydocs-mcp" });
    logger.info("Final metrics pushed to Pushgateway");
  } catch (error) {
    logger.error("Failed to push final metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
