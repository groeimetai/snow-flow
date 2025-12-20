/**
 * Memory Pool Manager
 * Optimizes Map/Set allocations and reuses objects for better memory efficiency
 */

export class MemoryPoolManager {
  private static mapPool: Map<string, any>[] = [];
  private static setPool: Set<any>[] = [];
  private static objectPool: any[] = [];
  
  private static readonly MAX_POOL_SIZE = 50;
  
  /**
   * Get a reusable Map instance
   */
  static getMap<K, V>(): Map<K, V> {
    if (this.mapPool.length > 0) {
      const map = this.mapPool.pop()! as Map<K, V>;
      map.clear(); // Ensure it's clean
      return map;
    }
    return new Map<K, V>();
  }
  
  /**
   * Return a Map to the pool for reuse
   */
  static releaseMap(map: Map<any, any>): void {
    if (this.mapPool.length < this.MAX_POOL_SIZE) {
      map.clear();
      this.mapPool.push(map);
    }
  }
  
  /**
   * Get a reusable Set instance
   */
  static getSet<T>(): Set<T> {
    if (this.setPool.length > 0) {
      const set = this.setPool.pop()!;
      set.clear(); // Ensure it's clean
      return set;
    }
    return new Set<T>();
  }
  
  /**
   * Return a Set to the pool for reuse
   */
  static releaseSet(set: Set<any>): void {
    if (this.setPool.length < this.MAX_POOL_SIZE) {
      set.clear();
      this.setPool.push(set);
    }
  }
  
  /**
   * Get a reusable object
   */
  static getObject(): any {
    if (this.objectPool.length > 0) {
      return this.objectPool.pop()!;
    }
    return {};
  }
  
  /**
   * Return an object to the pool
   */
  static releaseObject(obj: any): void {
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
  static clearPools(): void {
    this.mapPool.length = 0;
    this.setPool.length = 0;
    this.objectPool.length = 0;
  }
}