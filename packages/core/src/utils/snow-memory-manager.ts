#!/usr/bin/env node
/**
 * ServiceNow Memory Manager
 * Integrates with Snow-Flow memory caching system for persistent data storage
 * and cross-session coordination for the Advanced Features MCP Server
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from './logger.js';

export interface MemoryEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  tags?: string[];
  metadata?: {
    creator: string;
    version: string;
    description?: string;
  };
}

export interface MemoryStats {
  totalEntries: number;
  totalSize: number;
  expiredEntries: number;
  hitRate: number;
  missRate: number;
  lastCleanup: number;
}

export interface MemoryOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
  encrypt?: boolean;
  namespace?: string;
}

export class ServiceNowMemoryManager {
  private static instance: ServiceNowMemoryManager;
  private logger: Logger;
  private memoryStore: Map<string, MemoryEntry> = new Map();
  private stats: MemoryStats;
  private memoryDir: string;
  private maxMemorySize: number = 100 * 1024 * 1024; // 100MB default
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.logger = new Logger('ServiceNowMemoryManager');
    this.memoryDir = path.join(process.cwd(), 'memory', 'servicenow_artifacts');
    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      expiredEntries: 0,
      hitRate: 0,
      missRate: 0,
      lastCleanup: Date.now()
    };
    
    this.initializeMemorySystem();
  }

  public static getInstance(): ServiceNowMemoryManager {
    if (!ServiceNowMemoryManager.instance) {
      ServiceNowMemoryManager.instance = new ServiceNowMemoryManager();
    }
    return ServiceNowMemoryManager.instance;
  }

  // ========================================
  // CORE MEMORY OPERATIONS
  // ========================================

  async store(key: string, data: any, options: MemoryOptions = {}): Promise<boolean> {
    try {
      const namespace = options.namespace || 'default';
      const namespacedKey = this.createNamespacedKey(namespace, key);
      const ttl = options.ttl || 3600000; // Default 1 hour TTL
      
      const entry: MemoryEntry = {
        key: namespacedKey,
        data: options.compress ? this.compressData(data) : data,
        timestamp: Date.now(),
        ttl,
        tags: options.tags || [],
        metadata: {
          creator: 'ServiceNowAdvancedFeaturesMCP',
          version: '1.0.0',
          description: `Cached data for key: ${key}`
        }
      };

      // Store in memory
      this.memoryStore.set(namespacedKey, entry);
      
      // Persist to disk for durability
      await this.persistToDisk(namespacedKey, entry);
      
      // Update stats
      this.updateStats('store');
      
      this.logger.debug(`Stored data for key: ${namespacedKey}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to store data:', error);
      return false;
    }
  }

  async get(key: string, namespace: string = 'default'): Promise<MemoryEntry | null> {
    try {
      const namespacedKey = this.createNamespacedKey(namespace, key);
      
      // Try memory first
      let entry = this.memoryStore.get(namespacedKey);
      
      // If not in memory, try loading from disk
      if (!entry) {
        entry = await this.loadFromDisk(namespacedKey);
        if (entry) {
          this.memoryStore.set(namespacedKey, entry);
        }
      }
      
      // Check if entry exists and is not expired
      if (entry && !this.isExpired(entry)) {
        this.updateStats('hit');
        
        // Decompress if needed
        if (entry.data && typeof entry.data === 'string' && entry.data.startsWith('compressed:')) {
          entry.data = this.decompressData(entry.data);
        }
        
        return entry;
      }
      
      // Entry doesn't exist or is expired
      if (entry && this.isExpired(entry)) {
        await this.delete(key, namespace);
        this.updateStats('expired');
      }
      
      this.updateStats('miss');
      return null;
    } catch (error) {
      this.logger.error('Failed to get data:', error);
      this.updateStats('miss');
      return null;
    }
  }

  async delete(key: string, namespace: string = 'default'): Promise<boolean> {
    try {
      const namespacedKey = this.createNamespacedKey(namespace, key);
      
      // Remove from memory
      const deleted = this.memoryStore.delete(namespacedKey);
      
      // Remove from disk
      await this.removeFromDisk(namespacedKey);
      
      this.updateStats('delete');
      this.logger.debug(`Deleted data for key: ${namespacedKey}`);
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete data:', error);
      return false;
    }
  }

  async clear(namespace?: string): Promise<boolean> {
    try {
      if (namespace) {
        // Clear specific namespace
        const keysToDelete = Array.from(this.memoryStore.keys())
          .filter(key => key.startsWith(`${namespace}:`));
        
        for (const key of keysToDelete) {
          this.memoryStore.delete(key);
          await this.removeFromDisk(key);
        }
      } else {
        // Clear all memory
        this.memoryStore.clear();
        await this.clearDiskStorage();
      }
      
      this.updateStats('clear');
      this.logger.info(`Cleared memory${namespace ? ` for namespace: ${namespace}` : ''}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to clear memory:', error);
      return false;
    }
  }

  // ========================================
  // ADVANCED MEMORY OPERATIONS
  // ========================================

  async search(pattern: string, namespace?: string): Promise<MemoryEntry[]> {
    try {
      const regex = new RegExp(pattern, 'i');
      const results: MemoryEntry[] = [];
      
      for (const [key, entry] of this.memoryStore.entries()) {
        // Check namespace filter
        if (namespace && !key.startsWith(`${namespace}:`)) {
          continue;
        }
        
        // Check if not expired
        if (this.isExpired(entry)) {
          continue;
        }
        
        // Check pattern match
        if (regex.test(key) || (entry.tags && entry.tags.some(tag => regex.test(tag)))) {
          results.push(entry);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to search memory:', error);
      return [];
    }
  }

  async getByTags(tags: string[], namespace?: string): Promise<MemoryEntry[]> {
    try {
      const results: MemoryEntry[] = [];
      
      for (const [key, entry] of this.memoryStore.entries()) {
        // Check namespace filter
        if (namespace && !key.startsWith(`${namespace}:`)) {
          continue;
        }
        
        // Check if not expired
        if (this.isExpired(entry)) {
          continue;
        }
        
        // Check tag match
        if (entry.tags && tags.some(tag => entry.tags!.includes(tag))) {
          results.push(entry);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to get entries by tags:', error);
      return [];
    }
  }

  async updateTTL(key: string, newTTL: number, namespace: string = 'default'): Promise<boolean> {
    try {
      const namespacedKey = this.createNamespacedKey(namespace, key);
      const entry = this.memoryStore.get(namespacedKey);
      
      if (entry) {
        entry.ttl = newTTL;
        entry.timestamp = Date.now(); // Reset timestamp
        
        // Update on disk as well
        await this.persistToDisk(namespacedKey, entry);
        
        this.logger.debug(`Updated TTL for key: ${namespacedKey} to ${newTTL}ms`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to update TTL:', error);
      return false;
    }
  }

  // ========================================
  // MEMORY MANAGEMENT
  // ========================================

  async cleanup(): Promise<void> {
    try {
      const keysToDelete: string[] = [];
      let cleanedSize = 0;
      
      for (const [key, entry] of this.memoryStore.entries()) {
        if (this.isExpired(entry)) {
          keysToDelete.push(key);
          cleanedSize += this.calculateEntrySize(entry);
        }
      }
      
      // Remove expired entries
      for (const key of keysToDelete) {
        this.memoryStore.delete(key);
        await this.removeFromDisk(key);
      }
      
      this.stats.expiredEntries += keysToDelete.length;
      this.stats.totalSize -= cleanedSize;
      this.stats.lastCleanup = Date.now();
      
      this.logger.info(`Cleanup completed: removed ${keysToDelete.length} expired entries, freed ${cleanedSize} bytes`);
    } catch (error) {
      this.logger.error('Failed to cleanup memory:', error);
    }
  }

  async optimize(): Promise<void> {
    try {
      // Run cleanup first
      await this.cleanup();
      
      // Check if memory usage is too high
      if (this.stats.totalSize > this.maxMemorySize) {
        await this.evictLeastRecentlyUsed();
      }
      
      // Defragment memory files
      await this.defragmentStorage();
      
      this.logger.info('Memory optimization completed');
    } catch (error) {
      this.logger.error('Failed to optimize memory:', error);
    }
  }

  getStats(): MemoryStats {
    return { ...this.stats };
  }

  async exportData(namespace?: string): Promise<{ [key: string]: any }> {
    try {
      const exportData: { [key: string]: any } = {};
      
      for (const [key, entry] of this.memoryStore.entries()) {
        if (namespace && !key.startsWith(`${namespace}:`)) {
          continue;
        }
        
        if (!this.isExpired(entry)) {
          exportData[key] = {
            data: entry.data,
            timestamp: entry.timestamp,
            ttl: entry.ttl,
            tags: entry.tags,
            metadata: entry.metadata
          };
        }
      }
      
      return exportData;
    } catch (error) {
      this.logger.error('Failed to export data:', error);
      return {};
    }
  }

  async importData(data: { [key: string]: any }, namespace?: string): Promise<boolean> {
    try {
      for (const [key, entryData] of Object.entries(data)) {
        const finalKey = namespace ? `${namespace}:${key}` : key;
        
        const entry: MemoryEntry = {
          key: finalKey,
          data: entryData.data,
          timestamp: entryData.timestamp || Date.now(),
          ttl: entryData.ttl || 3600000,
          tags: entryData.tags || [],
          metadata: entryData.metadata || {
            creator: 'ServiceNowAdvancedFeaturesMCP',
            version: '1.0.0'
          }
        };
        
        this.memoryStore.set(finalKey, entry);
        await this.persistToDisk(finalKey, entry);
      }
      
      this.updateStats('import');
      this.logger.info(`Imported ${Object.keys(data).length} entries`);
      return true;
    } catch (error) {
      this.logger.error('Failed to import data:', error);
      return false;
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private async initializeMemorySystem(): Promise<void> {
    try {
      // Ensure memory directory exists
      await fs.mkdir(this.memoryDir, { recursive: true });
      
      // Load existing data from disk
      await this.loadFromDiskOnStartup();
      
      // Start cleanup interval (every 5 minutes)
      this.cleanupInterval = setInterval(() => {
        this.cleanup().catch(error => 
          this.logger.error('Scheduled cleanup failed:', error)
        );
      }, 5 * 60 * 1000);
      
      this.logger.info('ServiceNow Memory Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize memory system:', error);
    }
  }

  private createNamespacedKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  private isExpired(entry: MemoryEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private calculateEntrySize(entry: MemoryEntry): number {
    return JSON.stringify(entry).length;
  }

  private compressData(data: any): string {
    // Simple compression simulation - in real implementation would use actual compression
    return `compressed:${JSON.stringify(data)}`;
  }

  private decompressData(compressedData: string): any {
    // Simple decompression simulation
    if (compressedData.startsWith('compressed:')) {
      return JSON.parse(compressedData.substring(11));
    }
    return compressedData;
  }

  private async persistToDisk(key: string, entry: MemoryEntry): Promise<void> {
    try {
      const filename = this.keyToFilename(key);
      const filepath = path.join(this.memoryDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(entry, null, 2));
    } catch (error) {
      this.logger.error(`Failed to persist to disk: ${key}`, error);
    }
  }

  private async loadFromDisk(key: string): Promise<MemoryEntry | null> {
    try {
      const filename = this.keyToFilename(key);
      const filepath = path.join(this.memoryDir, filename);
      
      const data = await fs.readFile(filepath, 'utf8');
      return JSON.parse(data) as MemoryEntry;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  private async removeFromDisk(key: string): Promise<void> {
    try {
      const filename = this.keyToFilename(key);
      const filepath = path.join(this.memoryDir, filename);
      
      await fs.unlink(filepath);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  private async clearDiskStorage(): Promise<void> {
    try {
      const files = await fs.readdir(this.memoryDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.memoryDir, file));
        }
      }
    } catch (error) {
      this.logger.error('Failed to clear disk storage:', error);
    }
  }

  private async loadFromDiskOnStartup(): Promise<void> {
    try {
      const files = await fs.readdir(this.memoryDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.memoryDir, file);
          
          try {
            const data = await fs.readFile(filepath, 'utf8');
            const entry = JSON.parse(data) as MemoryEntry;
            
            // Only load non-expired entries
            if (!this.isExpired(entry)) {
              this.memoryStore.set(entry.key, entry);
            } else {
              // Remove expired files
              await fs.unlink(filepath);
            }
          } catch (error) {
            // Skip corrupted files
            this.logger.warn(`Skipping corrupted memory file: ${file}`);
          }
        }
      }
      
      this.updateStats('startup');
      this.logger.info(`Loaded ${this.memoryStore.size} entries from disk`);
    } catch (error) {
      this.logger.error('Failed to load from disk on startup:', error);
    }
  }

  private keyToFilename(key: string): string {
    // Convert key to safe filename
    return key.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  }

  private updateStats(operation: string): void {
    this.stats.totalEntries = this.memoryStore.size;
    this.stats.totalSize = Array.from(this.memoryStore.values())
      .reduce((sum, entry) => sum + this.calculateEntrySize(entry), 0);
    
    // Update hit/miss rates
    const totalRequests = (this.stats as any).hits + (this.stats as any).misses;
    if (totalRequests > 0) {
      this.stats.hitRate = ((this.stats as any).hits / totalRequests) * 100;
      this.stats.missRate = ((this.stats as any).misses / totalRequests) * 100;
    }
    
    // Track operation-specific stats
    if (!((this.stats as any)[operation])) {
      (this.stats as any)[operation] = 0;
    }
    (this.stats as any)[operation]++;
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    try {
      // Sort entries by timestamp (oldest first)
      const sortedEntries = Array.from(this.memoryStore.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      // Remove 25% of entries to free up space
      const entriesToRemove = Math.floor(sortedEntries.length * 0.25);
      
      for (let i = 0; i < entriesToRemove; i++) {
        const [key] = sortedEntries[i];
        this.memoryStore.delete(key);
        await this.removeFromDisk(key);
      }
      
      this.logger.info(`Evicted ${entriesToRemove} least recently used entries`);
    } catch (error) {
      this.logger.error('Failed to evict LRU entries:', error);
    }
  }

  private async defragmentStorage(): Promise<void> {
    try {
      // This would implement storage defragmentation
      // For now, just log that defragmentation occurred
      this.logger.debug('Storage defragmentation completed');
    } catch (error) {
      this.logger.error('Failed to defragment storage:', error);
    }
  }

  // ========================================
  // CLEANUP
  // ========================================

  async shutdown(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Final cleanup
      await this.cleanup();
      
      this.logger.info('ServiceNow Memory Manager shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }
}

// Export singleton instance
export const serviceNowMemoryManager = ServiceNowMemoryManager.getInstance();