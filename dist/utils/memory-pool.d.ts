/**
 * Memory Pool Manager
 * Optimizes Map/Set allocations and reuses objects for better memory efficiency
 */
export declare class MemoryPoolManager {
    private static mapPool;
    private static setPool;
    private static objectPool;
    private static readonly MAX_POOL_SIZE;
    /**
     * Get a reusable Map instance
     */
    static getMap<K, V>(): Map<K, V>;
    /**
     * Return a Map to the pool for reuse
     */
    static releaseMap(map: Map<any, any>): void;
    /**
     * Get a reusable Set instance
     */
    static getSet<T>(): Set<T>;
    /**
     * Return a Set to the pool for reuse
     */
    static releaseSet(set: Set<any>): void;
    /**
     * Get a reusable object
     */
    static getObject(): any;
    /**
     * Return an object to the pool
     */
    static releaseObject(obj: any): void;
    /**
     * Get pool statistics for monitoring
     */
    static getStats(): {
        maps: {
            available: number;
            maxSize: number;
        };
        sets: {
            available: number;
            maxSize: number;
        };
        objects: {
            available: number;
            maxSize: number;
        };
    };
    /**
     * Clear all pools (for testing/cleanup)
     */
    static clearPools(): void;
}
//# sourceMappingURL=memory-pool.d.ts.map