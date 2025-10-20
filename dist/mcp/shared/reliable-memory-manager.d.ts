/**
 * Reliable Memory Manager
 * Direct in-memory storage without database dependencies
 * Solves hanging issues with better-sqlite3
 */
export interface MemoryEntry {
    key: string;
    value: any;
    timestamp: Date;
    expiresAt?: Date;
    sizeBytes: number;
}
export declare class ReliableMemoryManager {
    private static instance;
    private memory;
    private logger;
    private readonly MAX_MEMORY_MB;
    private readonly PERSIST_FILE;
    private persistTimer;
    private constructor();
    static getInstance(): ReliableMemoryManager;
    /**
     * Store value in memory with size checking
     */
    store(key: string, value: any, expiresInMs?: number): Promise<void>;
    /**
     * Retrieve value from memory
     */
    retrieve(key: string): Promise<any>;
    /**
     * Delete a key from memory
     */
    delete(key: string): Promise<boolean>;
    /**
     * List all keys with optional pattern matching
     */
    list(pattern?: string): Promise<string[]>;
    /**
     * Clear all memory
     */
    clear(): Promise<void>;
    /**
     * Get memory usage statistics
     */
    getStats(): {
        entries: number;
        totalSizeBytes: number;
        totalSizeMB: number;
        maxSizeMB: number;
        utilizationPercent: number;
    };
    /**
     * Get total memory usage in bytes
     */
    private getMemoryUsageBytes;
    /**
     * Clean up expired entries
     */
    private cleanupExpired;
    /**
     * Persist memory to disk for recovery
     */
    private persistToDisk;
    /**
     * Load memory from disk
     */
    private loadFromDisk;
    /**
     * Start auto-persist timer
     */
    private startAutoPersist;
    /**
     * Stop auto-persist timer
     */
    destroy(): void;
}
export declare const reliableMemory: ReliableMemoryManager;
//# sourceMappingURL=reliable-memory-manager.d.ts.map