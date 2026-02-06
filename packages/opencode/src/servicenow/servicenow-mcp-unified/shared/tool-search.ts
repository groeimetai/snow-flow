/**
 * Tool Search - Session-based tool enabling for lazy loading mode
 *
 * Ported from snow-flow (JavaScript) to snow-flow-ts (TypeScript)
 *
 * This module provides:
 * - Tool index for lightweight search (name + description only)
 * - Per-session enabled tools tracking
 * - File-based persistence for enabled tools
 *
 * @see https://www.anthropic.com/engineering/advanced-tool-use
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { mcpDebug } from './mcp-debug.js';

/**
 * Tool index entry - lightweight representation for search
 */
export interface ToolIndexEntry {
  id: string;
  description: string;
  category: string;
  keywords: string[];
  deferred: boolean;
}

/**
 * Get the storage directory for enabled tools
 */
function getStorageDir(): string {
  // Use platform-specific data directory
  let dataDir: string;
  if (process.platform === 'darwin') {
    dataDir = path.join(os.homedir(), 'Library', 'Application Support', 'snow-code');
  } else if (process.platform === 'win32' && process.env.APPDATA) {
    dataDir = path.join(process.env.APPDATA, 'snow-code');
  } else {
    dataDir = path.join(os.homedir(), '.local', 'share', 'snow-code');
  }

  // Ensure directory exists
  const enabledToolsDir = path.join(dataDir, 'enabled-tools');
  if (!fs.existsSync(enabledToolsDir)) {
    fs.mkdirSync(enabledToolsDir, { recursive: true });
  }

  return enabledToolsDir;
}

/**
 * Get the file path for a session's enabled tools
 */
function getSessionFilePath(sessionID: string): string {
  // Sanitize sessionID to be filesystem-safe
  const safeSessionID = sessionID.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(getStorageDir(), `enabled-tools-${safeSessionID}.json`);
}

/**
 * Get the current session ID file path
 * This file is written by snow-code and read by MCP server
 */
function getCurrentSessionFilePath(): string {
  // Use platform-specific data directory
  let dataDir: string;
  if (process.platform === 'darwin') {
    dataDir = path.join(os.homedir(), 'Library', 'Application Support', 'snow-code');
  } else if (process.platform === 'win32' && process.env.APPDATA) {
    dataDir = path.join(process.env.APPDATA, 'snow-code');
  } else {
    dataDir = path.join(os.homedir(), '.local', 'share', 'snow-code');
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return path.join(dataDir, 'current-session.json');
}

/**
 * Get the current session ID from the session file
 * Falls back to environment variable or undefined
 */
export function getCurrentSessionId(): string | undefined {
  // First check environment variable
  if (process.env.SNOW_SESSION_ID) {
    return process.env.SNOW_SESSION_ID;
  }

  // Then check session file
  try {
    const filePath = getCurrentSessionFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (data.sessionId) {
        return data.sessionId;
      }
    }
  } catch (e: any) {
    mcpDebug(`[ToolSearch] Failed to read current session: ${e.message}`);
  }

  return undefined;
}

/**
 * Set the current session ID (called by snow-code when session starts)
 */
export function setCurrentSessionId(sessionId: string): void {
  try {
    const filePath = getCurrentSessionFilePath();
    const data = JSON.stringify({
      sessionId,
      updatedAt: new Date().toISOString()
    }, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    mcpDebug(`[ToolSearch] Set current session: ${sessionId}`);
  } catch (e: any) {
    mcpDebug(`[ToolSearch] Failed to set current session: ${e.message}`);
  }
}

// In-memory cache for enabled tools per session
const enabledToolsCache = new Map<string, Set<string>>();

// Tool index (lightweight search index)
let toolIndex: ToolIndexEntry[] = [];

/**
 * Persist enabled tools to storage
 */
async function persistEnabledTools(sessionID: string, tools: Set<string>): Promise<void> {
  try {
    const filePath = getSessionFilePath(sessionID);
    const data = JSON.stringify({
      sessionID,
      tools: Array.from(tools),
      updatedAt: new Date().toISOString()
    }, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    mcpDebug(`[ToolSearch] Persisted ${tools.size} enabled tools for session ${sessionID}`);
  } catch (e: any) {
    mcpDebug(`[ToolSearch] Failed to persist enabled tools: ${e.message}`);
  }
}

/**
 * Restore enabled tools from storage
 */
async function restoreEnabledTools(sessionID: string): Promise<Set<string>> {
  try {
    const filePath = getSessionFilePath(sessionID);
    if (!fs.existsSync(filePath)) {
      return new Set();
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data.tools && Array.isArray(data.tools)) {
      const tools = new Set<string>(data.tools);
      mcpDebug(`[ToolSearch] Restored ${tools.size} enabled tools for session ${sessionID}`);
      return tools;
    }
  } catch (e: any) {
    // File not found or parse error is expected for new sessions
    if (e.code !== 'ENOENT') {
      mcpDebug(`[ToolSearch] Failed to restore enabled tools: ${e.message}`);
    }
  }
  return new Set();
}

/**
 * ToolSearch namespace - session-based tool enabling
 */
export namespace ToolSearch {
  /**
   * Register a tool in the search index
   */
  export function registerTool(entry: ToolIndexEntry): void {
    const existing = toolIndex.findIndex(t => t.id === entry.id);
    if (existing >= 0) {
      toolIndex[existing] = entry;
    } else {
      toolIndex.push(entry);
    }
  }

  /**
   * Register multiple tools at once
   */
  export function registerTools(entries: ToolIndexEntry[]): void {
    for (const entry of entries) {
      registerTool(entry);
    }
  }

  /**
   * Get the tool index
   */
  export function getIndex(): ToolIndexEntry[] {
    return toolIndex;
  }

  /**
   * Clear the tool index
   */
  export function clearIndex(): void {
    toolIndex = [];
  }

  /**
   * Search tools by query using multiple strategies
   */
  export function search(query: string, limit: number = 20): ToolIndexEntry[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Score each tool
    const scored = toolIndex.map(tool => {
      let score = 0;
      const idLower = tool.id.toLowerCase();
      const descLower = tool.description.toLowerCase();
      const keywordsLower = tool.keywords.map(k => k.toLowerCase());

      // Exact ID match (highest priority)
      if (idLower === queryLower) score += 100;

      // ID contains query
      if (idLower.includes(queryLower)) score += 50;

      // ID starts with query
      if (idLower.startsWith(queryLower)) score += 30;

      // Description contains query
      if (descLower.includes(queryLower)) score += 20;

      // Keyword matches
      for (const kw of keywordsLower) {
        if (kw === queryLower) score += 40;
        if (kw.includes(queryLower)) score += 15;
      }

      // Word-level matching
      for (const word of queryWords) {
        if (idLower.includes(word)) score += 10;
        if (descLower.includes(word)) score += 5;
        for (const kw of keywordsLower) {
          if (kw.includes(word)) score += 8;
        }
      }

      // Category match
      if (tool.category.toLowerCase().includes(queryLower)) score += 25;

      return { tool, score };
    });

    // Filter and sort by score
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.tool);
  }

  /**
   * Enable a deferred tool for a session
   */
  export async function enableTool(sessionID: string, toolID: string): Promise<void> {
    if (!enabledToolsCache.has(sessionID)) {
      // Restore from disk if available
      const restored = await restoreEnabledTools(sessionID);
      enabledToolsCache.set(sessionID, restored);
    }
    enabledToolsCache.get(sessionID)!.add(toolID);
    // Persist to disk
    await persistEnabledTools(sessionID, enabledToolsCache.get(sessionID)!);
    mcpDebug(`[ToolSearch] Enabled tool '${toolID}' for session ${sessionID}`);
  }

  /**
   * Enable multiple deferred tools for a session
   */
  export async function enableTools(sessionID: string, toolIDs: string[]): Promise<void> {
    if (!enabledToolsCache.has(sessionID)) {
      // Restore from disk if available
      const restored = await restoreEnabledTools(sessionID);
      enabledToolsCache.set(sessionID, restored);
    }

    const cache = enabledToolsCache.get(sessionID)!;
    for (const toolID of toolIDs) {
      cache.add(toolID);
    }

    // Persist once after all additions
    await persistEnabledTools(sessionID, cache);
    mcpDebug(`[ToolSearch] Enabled ${toolIDs.length} tools for session ${sessionID}`);
  }

  /**
   * Check if a deferred tool is enabled for a session
   */
  export async function isToolEnabled(sessionID: string, toolID: string): Promise<boolean> {
    if (!enabledToolsCache.has(sessionID)) {
      // Restore from disk if available
      const restored = await restoreEnabledTools(sessionID);
      enabledToolsCache.set(sessionID, restored);
    }
    return enabledToolsCache.get(sessionID)?.has(toolID) ?? false;
  }

  /**
   * Get all enabled tools for a session
   */
  export async function getEnabledTools(sessionID: string): Promise<Set<string>> {
    if (!enabledToolsCache.has(sessionID)) {
      // Restore from disk if available
      const restored = await restoreEnabledTools(sessionID);
      enabledToolsCache.set(sessionID, restored);
    }
    return enabledToolsCache.get(sessionID) ?? new Set();
  }

  /**
   * Clear enabled tools for a session
   */
  export async function clearSession(sessionID: string): Promise<void> {
    enabledToolsCache.delete(sessionID);

    // Remove persisted file
    try {
      const filePath = getSessionFilePath(sessionID);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        mcpDebug(`[ToolSearch] Cleared session ${sessionID}`);
      }
    } catch (e: any) {
      mcpDebug(`[ToolSearch] Failed to clear session file: ${e.message}`);
    }
  }

  /**
   * Get statistics about the tool index
   */
  export function getStats(): {
    total: number;
    deferred: number;
    immediate: number;
    categories: Record<string, number>;
  } {
    const categories: Record<string, number> = {};
    let deferred = 0;
    let immediate = 0;

    for (const tool of toolIndex) {
      if (tool.deferred) {
        deferred++;
      } else {
        immediate++;
      }
      categories[tool.category] = (categories[tool.category] || 0) + 1;
    }

    return {
      total: toolIndex.length,
      deferred,
      immediate,
      categories
    };
  }

  /**
   * Get a tool from the index by ID
   */
  export function getToolFromIndex(toolId: string): ToolIndexEntry | undefined {
    return toolIndex.find(t => t.id === toolId);
  }

  /**
   * Get tool status for display
   * Returns [AVAILABLE], [ENABLED], or [DEFERRED]
   */
  export async function getToolStatus(
    sessionID: string | undefined,
    toolID: string
  ): Promise<'[AVAILABLE]' | '[ENABLED]' | '[DEFERRED]'> {
    const tool = getToolFromIndex(toolID);
    if (!tool) {
      // Unknown tool - treat as deferred (must be enabled via tool_search first)
      if (sessionID) {
        const enabled = await isToolEnabled(sessionID, toolID);
        if (enabled) {
          return '[ENABLED]';
        }
      }
      return '[DEFERRED]';
    }

    if (!tool.deferred) {
      return '[AVAILABLE]'; // Not deferred, always available
    }

    // Tool is deferred - check if enabled for this session
    if (sessionID) {
      const enabled = await isToolEnabled(sessionID, toolID);
      if (enabled) {
        return '[ENABLED]';
      }
    }

    return '[DEFERRED]';
  }

  /**
   * Check if a tool can be executed (not deferred OR enabled)
   */
  export async function canExecuteTool(sessionID: string | undefined, toolID: string): Promise<boolean> {
    const tool = getToolFromIndex(toolID);
    if (!tool) {
      // Unknown tool - treat as deferred (must be enabled via tool_search first)
      // This ensures lazy loading works even if tool index is incomplete
      if (sessionID) {
        return await isToolEnabled(sessionID, toolID);
      }
      return false;
    }

    if (!tool.deferred) {
      return true; // Not deferred, always available
    }

    // Tool is deferred - check if enabled for this session
    if (sessionID) {
      return await isToolEnabled(sessionID, toolID);
    }

    return false; // Deferred and no session = cannot execute
  }

  /**
   * Get the current session ID (re-exported from module level)
   * Used by MCP server to get sessionId when not passed in request
   */
  export const getCurrentSession = getCurrentSessionId;

  /**
   * Set the current session ID (re-exported from module level)
   * Called by snow-code when a session starts/changes
   */
  export const setCurrentSession = setCurrentSessionId;
}
