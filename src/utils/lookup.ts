/**
 * Lookup cache management
 */

import fs from "fs/promises";
import logger from "./logger.js";
import type { ClassLookup } from "../types/index.js";

let lookupCache: ClassLookup | null = null;

/**
 * Load the class lookup index from disk and cache it in memory
 */
export async function loadLookup(lookupFile: string): Promise<ClassLookup | null> {
  if (lookupCache) {
    return lookupCache;
  }

  try {
    const data = await fs.readFile(lookupFile, "utf-8");
    lookupCache = JSON.parse(data) as ClassLookup;
    logger.info("Lookup index loaded successfully", {
      classCount: Object.keys(lookupCache).length,
    });
    return lookupCache;
  } catch (error) {
    logger.error("Failed to load lookup index", {
      error: error instanceof Error ? error.message : String(error),
      path: lookupFile,
    });
    return null;
  }
}

/**
 * Clear the lookup cache (useful for testing or hot reloading)
 */
export function clearLookupCache(): void {
  lookupCache = null;
  logger.info("Lookup cache cleared");
}
