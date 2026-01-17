/**
 * MCP Tool handlers for Hytale documentation
 */

import fs from "fs/promises";
import path from "path";
import logger from "../utils/logger.js";
import { loadLookup } from "../utils/lookup.js";
import { mcpToolCallsTotal, mcpToolDurationSeconds } from "../utils/metrics.js";
import type {
  SearchHytaleClassesArgs,
  ReadHytaleClassDocsArgs,
} from "../types/index.js";

const MAX_SEARCH_RESULTS = 25;

/**
 * Search for Hytale API classes by name
 */
export async function searchHytaleClasses(
  args: SearchHytaleClassesArgs,
  lookupFile: string
): Promise<string> {
  const endTimer = mcpToolDurationSeconds.startTimer({ tool_name: "search_hydocs_classes" });

  try {
    const lookup = await loadLookup(lookupFile);
    if (!lookup) {
      throw new Error("Class lookup index not found");
    }

    const query = args.query.toLowerCase().trim();
    if (!query) {
      throw new Error("Search query cannot be empty");
    }

    const matches: string[] = [];
    const seenPaths = new Set<string>();

    // Search through all class names
    for (const [className, info] of Object.entries(lookup)) {
      if (className.toLowerCase().includes(query) && !seenPaths.has(info.path)) {
        seenPaths.add(info.path);
        matches.push(`- ${info.full_name} (${info.type})`);

        if (matches.length >= MAX_SEARCH_RESULTS) {
          break;
        }
      }
    }

    const result = matches.length > 0
      ? matches.join("\n")
      : "No matches found for your search query.";

    mcpToolCallsTotal.inc({ tool_name: "search_hydocs_classes", status: "success" });
    logger.info("Class search completed", { query, resultCount: matches.length });

    return result;
  } catch (error) {
    mcpToolCallsTotal.inc({ tool_name: "search_hydocs_classes", status: "error" });
    logger.error("Class search failed", {
      error: error instanceof Error ? error.message : String(error),
      query: args.query,
    });
    throw error;
  } finally {
    endTimer();
  }
}

/**
 * Read full documentation for a specific class
 */
export async function readHytaleClassDocs(
  args: ReadHytaleClassDocsArgs,
  lookupFile: string,
  docsDir: string
): Promise<string> {
  const endTimer = mcpToolDurationSeconds.startTimer({ tool_name: "read_hydocs_class_docs" });

  try {
    const lookup = await loadLookup(lookupFile);
    if (!lookup) {
      throw new Error("Class lookup index not found");
    }

    const className = args.full_class_name.trim();
    if (!className) {
      throw new Error("Class name cannot be empty");
    }

    // Try exact match first
    let classInfo = lookup[className];

    // Try case-insensitive match if exact match fails
    if (!classInfo) {
      const lowerClassName = className.toLowerCase();
      for (const [key, value] of Object.entries(lookup)) {
        if (key.toLowerCase() === lowerClassName) {
          classInfo = value;
          break;
        }
      }
    }

    if (!classInfo) {
      throw new Error(`Class "${className}" not found in documentation`);
    }

    const docPath = path.join(docsDir, classInfo.path);
    const content = await fs.readFile(docPath, "utf-8");

    mcpToolCallsTotal.inc({ tool_name: "read_hydocs_class_docs", status: "success" });
    logger.info("Class documentation read", {
      className,
      type: classInfo.type,
      path: classInfo.path,
    });

    return content;
  } catch (error) {
    mcpToolCallsTotal.inc({ tool_name: "read_hydocs_class_docs", status: "error" });
    logger.error("Failed to read class documentation", {
      error: error instanceof Error ? error.message : String(error),
      className: args.full_class_name,
    });
    throw error;
  } finally {
    endTimer();
  }
}
