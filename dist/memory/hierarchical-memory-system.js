"use strict";
/**
 * Hierarchical Memory System
 * Extended memory system with hierarchical organization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultHierarchicalMemorySystem = void 0;
class DefaultHierarchicalMemorySystem {
    constructor(dbPath, namespace) {
        this.memory = new Map();
        this.dbPath = dbPath;
        this.namespace = namespace || 'default';
    }
    getNamespaceMap(namespace) {
        if (!this.memory.has(namespace)) {
            this.memory.set(namespace, new Map());
        }
        return this.memory.get(namespace);
    }
    async store(key, value) {
        await this.storeInNamespace(this.namespace || 'default', key, value);
    }
    async retrieve(key) {
        return this.retrieveFromNamespace(this.namespace || 'default', key);
    }
    async get(key) {
        return this.retrieve(key);
    }
    async delete(key) {
        const nsMap = this.getNamespaceMap(this.namespace || 'default');
        return nsMap.delete(key);
    }
    async clear() {
        await this.clearNamespace(this.namespace || 'default');
    }
    async list() {
        const nsMap = this.getNamespaceMap(this.namespace || 'default');
        return Array.from(nsMap.keys());
    }
    async exists(key) {
        const nsMap = this.getNamespaceMap(this.namespace || 'default');
        return nsMap.has(key);
    }
    async storeInNamespace(namespace, key, value) {
        const nsMap = this.getNamespaceMap(namespace);
        nsMap.set(key, value);
    }
    async retrieveFromNamespace(namespace, key) {
        const nsMap = this.getNamespaceMap(namespace);
        return nsMap.get(key);
    }
    async listNamespaces() {
        return Array.from(this.memory.keys());
    }
    async clearNamespace(namespace) {
        this.memory.delete(namespace);
    }
}
exports.DefaultHierarchicalMemorySystem = DefaultHierarchicalMemorySystem;
//# sourceMappingURL=hierarchical-memory-system.js.map