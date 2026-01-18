/**
 * Configuration management
 */

import path from "path";
import { fileURLToPath } from "url";
import type { ServerConfig } from "../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_METRICS_PUSH_INTERVAL = 10000; // 10 seconds
const DEFAULT_DOCS_DOWNLOAD_TIMEOUT = 300000; // 5 minutes

/**
 * Load server configuration from environment variables with fallbacks
 */
export function loadConfig(): ServerConfig {
  const rootDir = path.join(__dirname, "../../..");
  const docsDir = process.env.DOCS_DIR || path.join(rootDir, "build");
  const lookupFile = path.join(docsDir, "class_lookup.json");

  return {
    port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
    docsDir,
    lookupFile,
    logLevel: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
    // Loki
    lokiUrl: process.env.LOKI_URL,
    enableLokiPush: process.env.ENABLE_LOKI_PUSH === "true",
    // Prometheus Pushgateway
    pushgatewayUrl: process.env.PUSHGATEWAY_URL,
    enableMetricsPush: process.env.ENABLE_METRICS_PUSH === "true",
    metricsPushInterval: parseInt(
      process.env.METRICS_PUSH_INTERVAL || String(DEFAULT_METRICS_PUSH_INTERVAL),
      10
    ),
    // Documentation Download
    docsUrl: process.env.DOCS_URL,
    docsDownloadTimeout: parseInt(
      process.env.DOCS_DOWNLOAD_TIMEOUT || String(DEFAULT_DOCS_DOWNLOAD_TIMEOUT),
      10
    ),
  };
}
