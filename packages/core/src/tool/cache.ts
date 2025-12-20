/**
 * Tool Call Caching System
 *
 * Provides intelligent caching for expensive/slow tool calls to improve
 * multi-agent development performance.
 *
 * Features:
 * - TTL-based expiration
 * - Content-based cache keys (deterministic)
 * - Per-tool cache configuration
 * - Cache hit/miss metrics
 * - Memory-efficient LRU eviction
 */

import { Tool } from "./tool"
import { createHash } from "crypto"
import type { z } from "zod/v4"

export namespace ToolCache {
  interface CacheEntry {
    result: {
      title: string
      metadata: any
      output: string
      attachments?: any[]
    }
    timestamp: number
    ttl: number
    hits: number
  }

  interface CacheStats {
    hits: number
    misses: number
    hitRate: number
    totalEntries: number
    memoryUsage: number
  }

  interface CacheConfig {
    enabled: boolean
    ttl: number // milliseconds
    maxEntries?: number
  }

  // Cache storage (in-memory for now, could be Redis/SQLite for persistence)
  const cache = new Map<string, CacheEntry>()
  let stats = { hits: 0, misses: 0 }

  // Default cache configuration per tool
  const defaultConfigs: Record<string, CacheConfig> = {
    // Read operations - cache for 1 minute
    read: { enabled: true, ttl: 60_000, maxEntries: 100 },
    glob: { enabled: true, ttl: 30_000, maxEntries: 50 },
    grep: { enabled: true, ttl: 30_000, maxEntries: 50 },
    ls: { enabled: true, ttl: 30_000, maxEntries: 50 },

    // MCP tools - longer cache for discovery/query operations
    "mcp__*__snow_discover_*": { enabled: true, ttl: 300_000, maxEntries: 20 }, // 5 min
    "mcp__*__snow_query_table": { enabled: true, ttl: 60_000, maxEntries: 50 }, // 1 min
    "mcp__*__snow_get_property": { enabled: true, ttl: 600_000, maxEntries: 30 }, // 10 min

    // Disable cache for mutation operations
    write: { enabled: false, ttl: 0 },
    edit: { enabled: false, ttl: 0 },
    bash: { enabled: false, ttl: 0 },
    "mcp__*__snow_create_*": { enabled: false, ttl: 0 },
    "mcp__*__snow_update_*": { enabled: false, ttl: 0 },
    "mcp__*__snow_deploy": { enabled: false, ttl: 0 },
  }

  /**
   * Generate deterministic cache key from tool ID and arguments
   */
  function getCacheKey(toolID: string, args: any): string {
    const argsHash = createHash("sha256")
      .update(JSON.stringify(args, Object.keys(args).sort()))
      .digest("hex")
      .substring(0, 16)
    return `${toolID}:${argsHash}`
  }

  /**
   * Get cache configuration for a tool
   */
  function getConfig(toolID: string): CacheConfig {
    // Exact match
    if (defaultConfigs[toolID]) {
      return defaultConfigs[toolID]
    }

    // Pattern match (e.g., "mcp__*__snow_discover_*")
    for (const [pattern, config] of Object.entries(defaultConfigs)) {
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$")
        if (regex.test(toolID)) {
          return config
        }
      }
    }

    // Default: no cache
    return { enabled: false, ttl: 0 }
  }

  /**
   * Check if cache entry is still valid
   */
  function isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl
  }

  /**
   * Get from cache
   */
  function get(toolID: string, args: any): CacheEntry | null {
    const config = getConfig(toolID)
    if (!config.enabled) {
      stats.misses++ // Count disabled tools as misses for stats
      return null
    }

    const key = getCacheKey(toolID, args)
    const entry = cache.get(key)

    if (!entry) {
      stats.misses++
      return null
    }

    if (!isValid(entry)) {
      cache.delete(key)
      stats.misses++
      return null
    }

    entry.hits++
    stats.hits++
    return entry
  }

  /**
   * Store in cache
   */
  function set(toolID: string, args: any, result: CacheEntry["result"]): void {
    const config = getConfig(toolID)
    if (!config.enabled) return

    const key = getCacheKey(toolID, args)
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: config.ttl,
      hits: 0,
    }

    cache.set(key, entry)

    // LRU eviction if max entries exceeded
    if (config.maxEntries && cache.size > config.maxEntries) {
      evictLRU(config.maxEntries)
    }
  }

  /**
   * Evict least recently used entries
   */
  function evictLRU(maxEntries: number): void {
    const entries = Array.from(cache.entries())
      .sort((a, b) => {
        // Sort by: 1) last access time, 2) hit count
        const aTime = a[1].timestamp + (a[1].hits * 1000)
        const bTime = b[1].timestamp + (b[1].hits * 1000)
        return aTime - bTime
      })

    const toDelete = entries.slice(0, entries.length - maxEntries)
    for (const [key] of toDelete) {
      cache.delete(key)
    }
  }

  /**
   * Clear cache (for testing or manual invalidation)
   */
  export function clear(pattern?: string): void {
    if (!pattern) {
      cache.clear()
      stats = { hits: 0, misses: 0 }
      return
    }

    const regex = new RegExp(pattern)
    for (const [key] of cache.entries()) {
      if (regex.test(key)) {
        cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  export function getStats(): CacheStats {
    const total = stats.hits + stats.misses
    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: total > 0 ? (stats.hits / total) * 100 : 0,
      totalEntries: cache.size,
      memoryUsage: estimateMemoryUsage(),
    }
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  function estimateMemoryUsage(): number {
    let bytes = 0
    for (const [key, entry] of cache.entries()) {
      bytes += key.length * 2 // UTF-16 string
      bytes += JSON.stringify(entry.result).length * 2
      bytes += 32 // metadata overhead
    }
    return bytes
  }

  /**
   * Wrap a tool with caching capability
   *
   * This is the main export that allows wrapping existing tools with cache logic.
   */
  export function withCache<P extends z.ZodType, M extends Record<string, any> = Record<string, any>>(
    tool: Tool.Info<P, M>
  ): Tool.Info<P, M> {
    return {
      id: tool.id,
      init: async () => {
        const toolDef = await tool.init()

        return {
          description: toolDef.description,
          parameters: toolDef.parameters,
          execute: async (args, ctx) => {
            // Check cache first
            const cached = get(tool.id, args)
            if (cached) {
              // Cache hit! Return cached result
              ctx.metadata({
                title: `${cached.result.title} (cached)`,
                metadata: {
                  ...(cached.result.metadata || {}),
                  cacheHit: true,
                  cacheAge: Date.now() - cached.timestamp,
                  cacheHits: cached.hits,
                },
              })
              return cached.result
            }

            // Cache miss - execute tool
            const result = await toolDef.execute(args, ctx)

            // Store in cache
            set(tool.id, args, result)

            // Add cache metadata
            return {
              ...result,
              metadata: {
                ...(result.metadata || {}),
                cacheHit: false,
              },
            }
          },
        }
      },
    }
  }

  /**
   * Configure cache for specific tool
   */
  export function configure(toolID: string, config: Partial<CacheConfig>): void {
    defaultConfigs[toolID] = {
      ...getConfig(toolID),
      ...config,
    }
  }

  /**
   * Get cache entry for debugging
   */
  export function inspect(toolID: string, args: any): CacheEntry | null {
    const key = getCacheKey(toolID, args)
    return cache.get(key) || null
  }
}
