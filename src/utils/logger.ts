/**
 * Logging utility using Winston
 */

import winston from "winston";
import LokiTransport from "winston-loki";
import { loadConfig } from "./config.js";

// Load config to check Loki settings
const config = loadConfig();

// Create transports array dynamically
const transports: winston.transport[] = [];

// Add Loki transport if enabled
if (config.enableLokiPush && config.lokiUrl) {
  transports.push(
    new LokiTransport({
      host: config.lokiUrl,
       labels: { service: "hydocs-mcp" },

      json: true,
      batching: true,
      interval: 5, // Send batch every 5 seconds
      onConnectionError: (err) => {
        console.error("Loki connection error:", err);
      },
    })
  );
}

// Add Console transport if:
// - Loki is not enabled, OR
// - We want both (controlled by not disabling console when Loki is active)
// For production with Loki, we disable console to reduce noise
const shouldEnableConsole = !config.enableLokiPush || config.logLevel === "debug";

if (shouldEnableConsole) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    })
  );
}

// Validate configuration
if (config.enableLokiPush && !config.lokiUrl) {
  console.warn("ENABLE_LOKI_PUSH is true but LOKI_URL is not set. Loki push disabled.");
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "hydocs-mcp" },
  transports,
});

export default logger;
