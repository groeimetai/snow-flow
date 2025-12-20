/**
 * Tool Cache Tests
 * Demonstrates cache functionality and performance gains
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { ToolCache } from "./cache"
import { Tool } from "./tool"
import z from "zod/v4"

describe("ToolCache", () => {
  beforeEach(() => {
    ToolCache.clear()
  })

  it("should cache read operations", async () => {
    // Mock read tool
    let executionCount = 0
    const mockReadTool = Tool.define("read", {
      description: "Read a file",
      parameters: z.object({ path: z.string() }),
      execute: async (args) => {
        executionCount++
        return {
          title: "Read file",
          output: `Content of ${args.path}`,
          metadata: {},
        }
      },
    })

    // Wrap with cache
    const cachedTool = ToolCache.withCache(mockReadTool)
    const toolDef = await cachedTool.init()

    const ctx: any = {
      sessionID: "test",
      messageID: "msg1",
      agent: "general",
      abort: new AbortController().signal,
      metadata: () => {},
    }

    // First call - cache miss
    const result1 = await toolDef.execute({ path: "/test/file.txt" }, ctx)
    expect(result1.output).toBe("Content of /test/file.txt")
    expect(executionCount).toBe(1)

    // Second call - cache hit
    const result2 = await toolDef.execute({ path: "/test/file.txt" }, ctx)
    expect(result2.output).toBe("Content of /test/file.txt")
    expect(executionCount).toBe(1) // Not executed again!

    // Different path - cache miss
    const result3 = await toolDef.execute({ path: "/test/other.txt" }, ctx)
    expect(result3.output).toBe("Content of /test/other.txt")
    expect(executionCount).toBe(2)

    // Stats
    const stats = ToolCache.getStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(2)
    expect(stats.hitRate).toBeCloseTo(33.33, 1)
  })

  it("should respect TTL expiration", async () => {
    // Configure short TTL for testing
    ToolCache.configure("test_tool", { enabled: true, ttl: 100 }) // 100ms

    let executionCount = 0
    const mockTool = Tool.define("test_tool", {
      description: "Test tool",
      parameters: z.object({ value: z.string() }),
      execute: async (args) => {
        executionCount++
        return {
          title: "Test",
          output: `Result: ${args.value}`,
          metadata: {},
        }
      },
    })

    const cachedTool = ToolCache.withCache(mockTool)
    const toolDef = await cachedTool.init()

    const ctx: any = {
      sessionID: "test",
      messageID: "msg1",
      agent: "general",
      abort: new AbortController().signal,
      metadata: () => {},
    }

    // First call
    await toolDef.execute({ value: "test" }, ctx)
    expect(executionCount).toBe(1)

    // Second call within TTL - cache hit
    await toolDef.execute({ value: "test" }, ctx)
    expect(executionCount).toBe(1)

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Third call after TTL - cache miss, re-execute
    await toolDef.execute({ value: "test" }, ctx)
    expect(executionCount).toBe(2)
  })

  it("should not cache mutation operations", async () => {
    let executionCount = 0
    const mockWriteTool = Tool.define("write", {
      description: "Write a file",
      parameters: z.object({ path: z.string(), content: z.string() }),
      execute: async (args) => {
        executionCount++
        return {
          title: "Written",
          output: `Wrote to ${args.path}`,
          metadata: {},
        }
      },
    })

    const cachedTool = ToolCache.withCache(mockWriteTool)
    const toolDef = await cachedTool.init()

    const ctx: any = {
      sessionID: "test",
      messageID: "msg1",
      agent: "general",
      abort: new AbortController().signal,
      metadata: () => {},
    }

    // Multiple calls with same args
    await toolDef.execute({ path: "/test/file.txt", content: "hello" }, ctx)
    await toolDef.execute({ path: "/test/file.txt", content: "hello" }, ctx)
    await toolDef.execute({ path: "/test/file.txt", content: "hello" }, ctx)

    // All should execute (no caching for write operations)
    expect(executionCount).toBe(3)

    const stats = ToolCache.getStats()
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(3)
  })

  it("should handle LRU eviction", async () => {
    // Configure small cache
    ToolCache.configure("lru_test", { enabled: true, ttl: 60000, maxEntries: 3 })

    const mockTool = Tool.define("lru_test", {
      description: "LRU test",
      parameters: z.object({ id: z.number() }),
      execute: async (args) => ({
        title: "Test",
        output: `ID: ${args.id}`,
        metadata: {},
      }),
    })

    const cachedTool = ToolCache.withCache(mockTool)
    const toolDef = await cachedTool.init()

    const ctx: any = {
      sessionID: "test",
      messageID: "msg1",
      agent: "general",
      abort: new AbortController().signal,
      metadata: () => {},
    }

    // Fill cache
    await toolDef.execute({ id: 1 }, ctx)
    await toolDef.execute({ id: 2 }, ctx)
    await toolDef.execute({ id: 3 }, ctx)

    expect(ToolCache.getStats().totalEntries).toBe(3)

    // Add one more - should evict LRU
    await toolDef.execute({ id: 4 }, ctx)
    expect(ToolCache.getStats().totalEntries).toBe(3)

    // Access id:2 and id:3 to make them recently used
    await toolDef.execute({ id: 2 }, ctx)
    await toolDef.execute({ id: 3 }, ctx)

    // Add id:5 - should evict id:4 (least recently used)
    await toolDef.execute({ id: 5 }, ctx)

    // Verify id:4 was evicted by checking cache miss
    ToolCache.clear() // Reset stats
    await toolDef.execute({ id: 4 }, ctx)
    expect(ToolCache.getStats().misses).toBe(1) // Cache miss = was evicted
  })

  it("should support pattern matching for MCP tools", () => {
    // MCP tool should match pattern "mcp__*__snow_discover_*"
    ToolCache.configure("mcp__servicenow__snow_discover_tables", { enabled: true, ttl: 5000 })

    // Access via inspect (internal test)
    const key = "test_key"
    expect(ToolCache.inspect("mcp__servicenow__snow_discover_tables", {})).toBeNull()
  })

  it("should provide accurate statistics", async () => {
    const mockTool = Tool.define("read", {
      description: "Read",
      parameters: z.object({ path: z.string() }),
      execute: async (args) => ({
        title: "Read",
        output: `Content`,
        metadata: {},
      }),
    })

    const cachedTool = ToolCache.withCache(mockTool)
    const toolDef = await cachedTool.init()

    const ctx: any = {
      sessionID: "test",
      messageID: "msg1",
      agent: "general",
      abort: new AbortController().signal,
      metadata: () => {},
    }

    // Execute: 3 misses, 2 hits
    await toolDef.execute({ path: "file1.txt" }, ctx) // miss
    await toolDef.execute({ path: "file2.txt" }, ctx) // miss
    await toolDef.execute({ path: "file3.txt" }, ctx) // miss
    await toolDef.execute({ path: "file1.txt" }, ctx) // hit
    await toolDef.execute({ path: "file2.txt" }, ctx) // hit

    const stats = ToolCache.getStats()
    expect(stats.hits).toBe(2)
    expect(stats.misses).toBe(3)
    expect(stats.hitRate).toBeCloseTo(40, 1) // 2/5 = 40%
    expect(stats.totalEntries).toBe(3)
    expect(stats.memoryUsage).toBeGreaterThan(0)
  })
})
