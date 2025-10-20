"use strict";
/**
 * Basic Memory System Interface
 * Minimal implementation to satisfy missing imports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultMemorySystem = exports.BasicMemorySystem = void 0;
class BasicMemorySystem {
    constructor() {
        this.memory = new Map();
    }
    async store(key, value, ttl) {
        this.memory.set(key, value);
    }
    async retrieve(key) {
        return this.memory.get(key);
    }
    async get(key) {
        return this.memory.get(key);
    }
    async delete(key) {
        return this.memory.delete(key);
    }
    async clear() {
        this.memory.clear();
    }
    async list() {
        return Array.from(this.memory.keys());
    }
    async exists(key) {
        return this.memory.has(key);
    }
}
exports.BasicMemorySystem = BasicMemorySystem;
exports.defaultMemorySystem = new BasicMemorySystem();
//# sourceMappingURL=memory-system.js.map