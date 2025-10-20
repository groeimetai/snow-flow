"use strict";
/**
 * Memory Pool Manager
 * Optimizes Map/Set allocations and reuses objects for better memory efficiency
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryPoolManager = void 0;
class MemoryPoolManager {
    /**
     * Get a reusable Map instance
     */
    static getMap() {
        if (this.mapPool.length > 0) {
            const map = this.mapPool.pop();
            map.clear(); // Ensure it's clean
            return map;
        }
        return new Map();
    }
    /**
     * Return a Map to the pool for reuse
     */
    static releaseMap(map) {
        if (this.mapPool.length < this.MAX_POOL_SIZE) {
            map.clear();
            this.mapPool.push(map);
        }
    }
    /**
     * Get a reusable Set instance
     */
    static getSet() {
        if (this.setPool.length > 0) {
            const set = this.setPool.pop();
            set.clear(); // Ensure it's clean
            return set;
        }
        return new Set();
    }
    /**
     * Return a Set to the pool for reuse
     */
    static releaseSet(set) {
        if (this.setPool.length < this.MAX_POOL_SIZE) {
            set.clear();
            this.setPool.push(set);
        }
    }
    /**
     * Get a reusable object
     */
    static getObject() {
        if (this.objectPool.length > 0) {
            return this.objectPool.pop();
        }
        return {};
    }
    /**
     * Return an object to the pool
     */
    static releaseObject(obj) {
        if (this.objectPool.length < this.MAX_POOL_SIZE) {
            // Clear all properties
            for (const key in obj) {
                delete obj[key];
            }
            this.objectPool.push(obj);
        }
    }
    /**
     * Get pool statistics for monitoring
     */
    static getStats() {
        return {
            maps: {
                available: this.mapPool.length,
                maxSize: this.MAX_POOL_SIZE
            },
            sets: {
                available: this.setPool.length,
                maxSize: this.MAX_POOL_SIZE
            },
            objects: {
                available: this.objectPool.length,
                maxSize: this.MAX_POOL_SIZE
            }
        };
    }
    /**
     * Clear all pools (for testing/cleanup)
     */
    static clearPools() {
        this.mapPool.length = 0;
        this.setPool.length = 0;
        this.objectPool.length = 0;
    }
}
exports.MemoryPoolManager = MemoryPoolManager;
MemoryPoolManager.mapPool = [];
MemoryPoolManager.setPool = [];
MemoryPoolManager.objectPool = [];
MemoryPoolManager.MAX_POOL_SIZE = 50;
//# sourceMappingURL=memory-pool.js.map