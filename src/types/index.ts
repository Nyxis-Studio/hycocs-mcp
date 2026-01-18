/**
 * Type definitions for Hytale MCP Server
 */

export interface ClassInfo {
  full_name: string;
  path: string;
  type: "class" | "interface" | "enum";
  package: string;
}

export interface ClassLookup {
  [className: string]: ClassInfo;
}

export interface ServerConfig {
  port: number;
  docsDir: string;
  lookupFile: string;
  logLevel: string;
  // Loki
  lokiUrl?: string;
  enableLokiPush: boolean;
  // Prometheus Pushgateway
  pushgatewayUrl?: string;
  enableMetricsPush: boolean;
  metricsPushInterval: number;
  // Documentation Download
  docsUrl?: string;
  docsDownloadTimeout: number;
}

export interface ToolCallMetrics {
  tool_name: string;
  status: "success" | "error";
}

export interface ConnectionMetrics {
  ip: string;
}

export interface SearchHytaleClassesArgs {
  query: string;
}

export interface ReadHytaleClassDocsArgs {
  full_class_name: string;
}
