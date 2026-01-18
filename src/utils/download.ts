/**
 * Documentation download and extraction utilities
 */

import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import logger from "./logger.js";
import type { ServerConfig } from "../types/index.js";

const LAST_URL_FILE = ".last-download-url";

/**
 * Main function to download and extract documentation
 * Called from index.ts before server starts
 */
export async function downloadAndExtractDocs(config: ServerConfig): Promise<void> {
  if (!config.docsUrl) {
    logger.debug("No DOCS_URL provided, skipping download");
    return;
  }

  logger.info("Checking documentation download status", { docsUrl: config.docsUrl });

  const urlChanged = await hasUrlChanged(config.docsDir, config.docsUrl);

  if (!urlChanged) {
    logger.info("Skipping download, URL unchanged");
    return;
  }

  logger.info("URL changed, downloading new documentation", { docsUrl: config.docsUrl });

  try {
    // Download the ZIP file
    const zipBuffer = await downloadFile(config.docsUrl, config.docsDownloadTimeout);
    logger.info("Documentation downloaded successfully", {
      size: `${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`,
    });

    // Extract to docs directory
    await extractZip(zipBuffer, config.docsDir);
    logger.info("Documentation extracted successfully", { docsDir: config.docsDir });

    // Validate extraction
    const isValid = await validateDocsDirectory(config.docsDir);
    if (!isValid) {
      throw new Error("Extracted documentation is missing class_lookup.json");
    }

    // Save the URL for future comparisons
    await saveLastUrl(config.docsDir, config.docsUrl);
    logger.info("Documentation download completed successfully");
  } catch (error) {
    logger.error("Failed to download and extract documentation", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check if the current URL is different from the last downloaded URL
 */
export async function hasUrlChanged(docsDir: string, currentUrl: string): Promise<boolean> {
  const lastUrlPath = path.join(docsDir, LAST_URL_FILE);

  try {
    // Try to read the last URL
    const lastUrl = await fs.readFile(lastUrlPath, "utf-8");
    return lastUrl.trim() !== currentUrl.trim();
  } catch (error) {
    // File doesn't exist or can't be read - this is the first download
    logger.debug("No previous download URL found", {
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/**
 * Save the current URL to track future changes
 */
export async function saveLastUrl(docsDir: string, url: string): Promise<void> {
  const lastUrlPath = path.join(docsDir, LAST_URL_FILE);

  try {
    await fs.writeFile(lastUrlPath, url, "utf-8");
    logger.debug("Saved last download URL", { path: lastUrlPath });
  } catch (error) {
    logger.warn("Failed to save last download URL", {
      error: error instanceof Error ? error.message : String(error),
      path: lastUrlPath,
    });
  }
}

/**
 * Download a file from a URL with timeout support
 */
export async function downloadFile(url: string, timeout: number): Promise<Buffer> {
  logger.info("Starting download", { url, timeout: `${timeout}ms` });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Download timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract a ZIP file to a destination directory
 */
export async function extractZip(buffer: Buffer, destDir: string): Promise<void> {
  logger.info("Extracting ZIP archive", { destDir });

  try {
    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true });

    // Create ZIP instance from buffer
    const zip = new AdmZip(buffer);

    // Extract all files
    zip.extractAllTo(destDir, true);

    logger.debug("ZIP extraction completed");
  } catch (error) {
    logger.error("ZIP extraction failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to extract ZIP: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate that the documentation directory contains required files
 */
export async function validateDocsDirectory(docsDir: string): Promise<boolean> {
  try {
    // Check if directory exists
    await fs.access(docsDir);

    // Check if class_lookup.json exists
    const lookupFile = path.join(docsDir, "class_lookup.json");
    await fs.access(lookupFile);

    logger.debug("Documentation directory validation passed", { docsDir });
    return true;
  } catch (error) {
    logger.debug("Documentation directory validation failed", {
      docsDir,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
