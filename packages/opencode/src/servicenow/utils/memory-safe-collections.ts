/**
 * Memory-safe collections for snow-flow
 * Prevents unbounded growth of Maps and Sets
 *
 * @module memory-safe-collections
 */

/**
 * BoundedMap - A Map implementation with a maximum size limit
 * When the limit is reached, the oldest entries are evicted based on the eviction strategy
 */
export class BoundedMap<K, V> extends Map<K, V> {
  private maxSize: number
  private evictionStrategy: "lru" | "fifo"
  private accessOrder: K[] = []

  /**
   * Create a new BoundedMap
   * @param maxSize Maximum number of entries (default: 1000)
   * @param evictionStrategy 'lru' for Least Recently Used, 'fifo' for First In First Out (default: 'lru')
   */
  constructor(maxSize: number = 1000, evictionStrategy: "lru" | "fifo" = "lru") {
    super()
    this.maxSize = maxSize
    this.evictionStrategy = evictionStrategy
  }

  /**
   * Set a key-value pair, evicting oldest entry if at capacity
   */
  set(key: K, value: V): this {
    // Update access order for LRU
    if (this.evictionStrategy === "lru") {
      const idx = this.accessOrder.indexOf(key)
      if (idx > -1) {
        this.accessOrder.splice(idx, 1)
      }
      this.accessOrder.push(key)
    } else if (this.evictionStrategy === "fifo" && !this.has(key)) {
      // For FIFO, only add to order if it's a new key
      this.accessOrder.push(key)
    }

    // Evict oldest if at capacity
    if (this.size >= this.maxSize && !this.has(key)) {
      const evictKey = this.accessOrder.shift()
      if (evictKey !== undefined) {
        super.delete(evictKey)
      }
    }

    return super.set(key, value)
  }

  /**
   * Get a value, updating access order for LRU
   */
  get(key: K): V | undefined {
    // Update access order for LRU
    if (this.evictionStrategy === "lru" && this.has(key)) {
      const idx = this.accessOrder.indexOf(key)
      if (idx > -1) {
        this.accessOrder.splice(idx, 1)
        this.accessOrder.push(key)
      }
    }
    return super.get(key)
  }

  /**
   * Delete a key-value pair
   */
  delete(key: K): boolean {
    const idx = this.accessOrder.indexOf(key)
    if (idx > -1) {
      this.accessOrder.splice(idx, 1)
    }
    return super.delete(key)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.accessOrder = []
    super.clear()
  }

  /**
   * Get the maximum size
   */
  getMaxSize(): number {
    return this.maxSize
  }

  /**
   * Get the eviction strategy
   */
  getEvictionStrategy(): "lru" | "fifo" {
    return this.evictionStrategy
  }

  /**
   * Get statistics about the map
   */
  getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.size,
      maxSize: this.maxSize,
      utilization: this.size / this.maxSize,
    }
  }
}

/**
 * BoundedSet - A Set implementation with a maximum size limit
 * When the limit is reached, the oldest entries are evicted (FIFO)
 */
export class BoundedSet<T> extends Set<T> {
  private maxSize: number
  private insertionOrder: T[] = []

  /**
   * Create a new BoundedSet
   * @param maxSize Maximum number of entries (default: 1000)
   */
  constructor(maxSize: number = 1000) {
    super()
    this.maxSize = maxSize
  }

  /**
   * Add a value, evicting oldest entry if at capacity
   */
  add(value: T): this {
    if (this.size >= this.maxSize && !this.has(value)) {
      const evictValue = this.insertionOrder.shift()
      if (evictValue !== undefined) {
        super.delete(evictValue)
      }
    }

    if (!this.has(value)) {
      this.insertionOrder.push(value)
    }

    return super.add(value)
  }

  /**
   * Delete a value
   */
  delete(value: T): boolean {
    const idx = this.insertionOrder.indexOf(value)
    if (idx > -1) {
      this.insertionOrder.splice(idx, 1)
    }
    return super.delete(value)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.insertionOrder = []
    super.clear()
  }

  /**
   * Get the maximum size
   */
  getMaxSize(): number {
    return this.maxSize
  }

  /**
   * Get statistics about the set
   */
  getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.size,
      maxSize: this.maxSize,
      utilization: this.size / this.maxSize,
    }
  }
}

/**
 * BoundedArray - An array with a maximum size limit
 * When the limit is reached, the oldest entries are removed from the front
 */
export class BoundedArray<T> extends Array<T> {
  private maxSize: number

  /**
   * Create a new BoundedArray
   * @param maxSize Maximum number of entries (default: 1000)
   */
  constructor(maxSize: number = 1000) {
    super()
    this.maxSize = maxSize
  }

  /**
   * Push values, removing oldest if over capacity
   */
  push(...items: T[]): number {
    const result = super.push(...items)

    // Remove oldest entries if over capacity
    while (this.length > this.maxSize) {
      this.shift()
    }

    return Math.min(result, this.maxSize)
  }

  /**
   * Get the maximum size
   */
  getMaxSize(): number {
    return this.maxSize
  }

  /**
   * Get statistics about the array
   */
  getStats(): { length: number; maxSize: number; utilization: number } {
    return {
      length: this.length,
      maxSize: this.maxSize,
      utilization: this.length / this.maxSize,
    }
  }
}
