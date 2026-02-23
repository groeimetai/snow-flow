/**
 * Reliable Memory Manager
 * Direct in-memory storage without database dependencies
 * Solves hanging issues with better-sqlite3
 */

import * as fs from "fs"
import * as path from "path"
import { Logger } from "../utils/logger.js"

export interface MemoryEntry {
  key: string
  value: any
  timestamp: Date
  expiresAt?: Date
  sizeBytes: number
}

export class ReliableMemoryManager {
  private static instance: ReliableMemoryManager
  private memory: Map<string, MemoryEntry> = new Map()
  private logger: Logger
  private readonly MAX_MEMORY_MB = 100 // 100MB max memory usage
  private readonly PERSIST_FILE: string
  private persistTimer: NodeJS.Timeout | null = null

  private constructor() {
    this.logger = new Logger("ReliableMemoryManager")

    // Persistence file for recovery
    const memoryDir = path.join(process.cwd(), ".snow-flow", "memory")
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true })
    }
    this.PERSIST_FILE = path.join(memoryDir, "memory-snapshot.json")

    // Load previous memory if exists
    this.loadFromDisk()

    // Auto-persist every 30 seconds
    this.startAutoPersist()
  }

  static getInstance(): ReliableMemoryManager {
    if (!ReliableMemoryManager.instance) {
      ReliableMemoryManager.instance = new ReliableMemoryManager()
    }
    return ReliableMemoryManager.instance
  }

  /**
   * Store value in memory with size checking
   */
  async store(key: string, value: any, expiresInMs?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    const sizeBytes = Buffer.byteLength(serialized)

    // Check total memory usage
    const currentUsage = this.getMemoryUsageBytes()
    const newUsage = currentUsage + sizeBytes
    const maxBytes = this.MAX_MEMORY_MB * 1024 * 1024

    if (newUsage > maxBytes) {
      // Try to free expired entries first
      this.cleanupExpired()

      // Check again
      const afterCleanup = this.getMemoryUsageBytes() + sizeBytes
      if (afterCleanup > maxBytes) {
        throw new Error(
          `Memory limit exceeded. Current: ${(currentUsage / 1024 / 1024).toFixed(2)}MB, ` +
            `Requested: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB, ` +
            `Max: ${this.MAX_MEMORY_MB}MB`,
        )
      }
    }

    const entry: MemoryEntry = {
      key,
      value,
      timestamp: new Date(),
      sizeBytes,
      expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : undefined,
    }

    this.memory.set(key, entry)
    // Only log large stores (>100KB) to reduce log spam
    if (sizeBytes > 100 * 1024) {
      this.logger.debug(`Stored key '${key}' (${(sizeBytes / 1024).toFixed(2)}KB)`)
    }
  }

  /**
   * Retrieve value from memory
   */
  async retrieve(key: string): Promise<any> {
    const entry = this.memory.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.memory.delete(key)
      this.logger.debug(`Key '${key}' expired and removed`)
      return null
    }

    return entry.value
  }

  /**
   * Delete a key from memory
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.memory.has(key)
    this.memory.delete(key)
    return existed
  }

  /**
   * List all keys with optional pattern matching
   */
  async list(pattern?: string): Promise<string[]> {
    this.cleanupExpired()

    const keys = Array.from(this.memory.keys())

    if (pattern) {
      const regex = new RegExp(pattern)
      return keys.filter((key) => regex.test(key))
    }

    return keys
  }

  /**
   * Clear all memory
   */
  async clear(): Promise<void> {
    const count = this.memory.size
    this.memory.clear()
    this.logger.info(`Cleared ${count} entries from memory`)
  }

  /**
   * Get memory usage statistics
   */
  getStats(): {
    entries: number
    totalSizeBytes: number
    totalSizeMB: number
    maxSizeMB: number
    utilizationPercent: number
  } {
    const totalSizeBytes = this.getMemoryUsageBytes()
    const totalSizeMB = totalSizeBytes / 1024 / 1024

    return {
      entries: this.memory.size,
      totalSizeBytes,
      totalSizeMB,
      maxSizeMB: this.MAX_MEMORY_MB,
      utilizationPercent: (totalSizeMB / this.MAX_MEMORY_MB) * 100,
    }
  }

  /**
   * Get total memory usage in bytes
   */
  private getMemoryUsageBytes(): number {
    let total = 0
    for (const entry of this.memory.values()) {
      total += entry.sizeBytes
    }
    return total
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = new Date()
    let removed = 0

    for (const [key, entry] of this.memory.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.memory.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired entries`)
    }
  }

  /**
   * Persist memory to disk for recovery
   */
  private async persistToDisk(): Promise<void> {
    try {
      const data = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        entries: Array.from(this.memory.entries()).map(([key, entry]) => ({
          key,
          value: entry.value,
          timestamp: entry.timestamp,
          expiresAt: entry.expiresAt,
          sizeBytes: entry.sizeBytes,
        })),
      }

      await fs.promises.writeFile(this.PERSIST_FILE, JSON.stringify(data, null, 2), "utf-8")

      // Only log if there are entries (reduce spam for empty persists)
      if (this.memory.size > 0) {
        this.logger.debug(`Persisted ${this.memory.size} entries to disk`)
      }
    } catch (error: any) {
      this.logger.error("Failed to persist memory to disk:", error)
    }
  }

  /**
   * Load memory from disk
   */
  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.PERSIST_FILE)) {
        return
      }

      // Read file content
      const fileContent = fs.readFileSync(this.PERSIST_FILE, "utf-8")

      // Handle empty or whitespace-only file
      if (!fileContent || fileContent.trim().length === 0) {
        this.logger.debug("Memory persist file is empty, starting with fresh memory")
        return
      }

      // Parse JSON
      const data = JSON.parse(fileContent)

      if (data.version !== "1.0") {
        this.logger.warn("Incompatible memory snapshot version, skipping load")
        return
      }

      // Validate data structure
      if (!data.entries || !Array.isArray(data.entries)) {
        this.logger.warn("Invalid memory snapshot structure, skipping load")
        return
      }

      for (const entry of data.entries) {
        this.memory.set(entry.key, {
          key: entry.key,
          value: entry.value,
          timestamp: new Date(entry.timestamp),
          expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : undefined,
          sizeBytes: entry.sizeBytes,
        })
      }

      this.cleanupExpired()
      this.logger.info(`Loaded ${this.memory.size} entries from disk`)
    } catch (error: any) {
      this.logger.error("Failed to load memory from disk:", error)
      // Don't throw - allow system to start with fresh memory
    }
  }

  /**
   * Start auto-persist timer
   */
  private startAutoPersist(): void {
    // Persist every 5 minutes (reduced from 30 seconds to prevent log spam)
    this.persistTimer = setInterval(
      () => {
        this.persistToDisk().catch((error) => {
          this.logger.error("Auto-persist failed:", error)
        })
      },
      5 * 60 * 1000,
    ) // 5 minutes

    // Don't block process exit
    if (this.persistTimer.unref) {
      this.persistTimer.unref()
    }

    // Persist on exit
    process.on("beforeExit", () => {
      this.persistToDisk()
    })
  }

  /**
   * Stop auto-persist timer
   */
  destroy(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer)
      this.persistTimer = null
    }
    this.persistToDisk()
  }
}

// Export singleton instance
export const reliableMemory = ReliableMemoryManager.getInstance()
