#!/usr/bin/env node
/**
 * ServiceNow Memory Manager
 * Integrates with Snow-Flow memory caching system for persistent data storage
 * and cross-session coordination for the Advanced Features MCP Server
 */
export interface MemoryEntry {
    key: string;
    data: any;
    timestamp: number;
    ttl: number;
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
export declare class ServiceNowMemoryManager {
    private static instance;
    private logger;
    private memoryStore;
    private stats;
    private memoryDir;
    private maxMemorySize;
    private cleanupInterval;
    private constructor();
    static getInstance(): ServiceNowMemoryManager;
    store(key: string, data: any, options?: MemoryOptions): Promise<boolean>;
    get(key: string, namespace?: string): Promise<MemoryEntry | null>;
    delete(key: string, namespace?: string): Promise<boolean>;
    clear(namespace?: string): Promise<boolean>;
    search(pattern: string, namespace?: string): Promise<MemoryEntry[]>;
    getByTags(tags: string[], namespace?: string): Promise<MemoryEntry[]>;
    updateTTL(key: string, newTTL: number, namespace?: string): Promise<boolean>;
    cleanup(): Promise<void>;
    optimize(): Promise<void>;
    getStats(): MemoryStats;
    exportData(namespace?: string): Promise<{
        [key: string]: any;
    }>;
    importData(data: {
        [key: string]: any;
    }, namespace?: string): Promise<boolean>;
    private initializeMemorySystem;
    private createNamespacedKey;
    private isExpired;
    private calculateEntrySize;
    private compressData;
    private decompressData;
    private persistToDisk;
    private loadFromDisk;
    private removeFromDisk;
    private clearDiskStorage;
    private loadFromDiskOnStartup;
    private keyToFilename;
    private updateStats;
    private evictLeastRecentlyUsed;
    private defragmentStorage;
    shutdown(): Promise<void>;
}
export declare const serviceNowMemoryManager: ServiceNowMemoryManager;
//# sourceMappingURL=snow-memory-manager.d.ts.map