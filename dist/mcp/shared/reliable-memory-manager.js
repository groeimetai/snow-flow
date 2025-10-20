"use strict";
/**
 * Reliable Memory Manager
 * Direct in-memory storage without database dependencies
 * Solves hanging issues with better-sqlite3
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reliableMemory = exports.ReliableMemoryManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_js_1 = require("../../utils/logger.js");
class ReliableMemoryManager {
    constructor() {
        this.memory = new Map();
        this.MAX_MEMORY_MB = 100; // 100MB max memory usage
        this.persistTimer = null;
        this.logger = new logger_js_1.Logger('ReliableMemoryManager');
        // Persistence file for recovery
        const memoryDir = path.join(process.cwd(), '.snow-flow', 'memory');
        if (!fs.existsSync(memoryDir)) {
            fs.mkdirSync(memoryDir, { recursive: true });
        }
        this.PERSIST_FILE = path.join(memoryDir, 'memory-snapshot.json');
        // Load previous memory if exists
        this.loadFromDisk();
        // Auto-persist every 30 seconds
        this.startAutoPersist();
    }
    static getInstance() {
        if (!ReliableMemoryManager.instance) {
            ReliableMemoryManager.instance = new ReliableMemoryManager();
        }
        return ReliableMemoryManager.instance;
    }
    /**
     * Store value in memory with size checking
     */
    async store(key, value, expiresInMs) {
        const serialized = JSON.stringify(value);
        const sizeBytes = Buffer.byteLength(serialized);
        // Check total memory usage
        const currentUsage = this.getMemoryUsageBytes();
        const newUsage = currentUsage + sizeBytes;
        const maxBytes = this.MAX_MEMORY_MB * 1024 * 1024;
        if (newUsage > maxBytes) {
            // Try to free expired entries first
            this.cleanupExpired();
            // Check again
            const afterCleanup = this.getMemoryUsageBytes() + sizeBytes;
            if (afterCleanup > maxBytes) {
                throw new Error(`Memory limit exceeded. Current: ${(currentUsage / 1024 / 1024).toFixed(2)}MB, ` +
                    `Requested: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB, ` +
                    `Max: ${this.MAX_MEMORY_MB}MB`);
            }
        }
        const entry = {
            key,
            value,
            timestamp: new Date(),
            sizeBytes,
            expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : undefined
        };
        this.memory.set(key, entry);
        this.logger.debug(`Stored key '${key}' (${(sizeBytes / 1024).toFixed(2)}KB)`);
    }
    /**
     * Retrieve value from memory
     */
    async retrieve(key) {
        const entry = this.memory.get(key);
        if (!entry) {
            return null;
        }
        // Check if expired
        if (entry.expiresAt && entry.expiresAt < new Date()) {
            this.memory.delete(key);
            this.logger.debug(`Key '${key}' expired and removed`);
            return null;
        }
        return entry.value;
    }
    /**
     * Delete a key from memory
     */
    async delete(key) {
        const existed = this.memory.has(key);
        this.memory.delete(key);
        return existed;
    }
    /**
     * List all keys with optional pattern matching
     */
    async list(pattern) {
        this.cleanupExpired();
        const keys = Array.from(this.memory.keys());
        if (pattern) {
            const regex = new RegExp(pattern);
            return keys.filter(key => regex.test(key));
        }
        return keys;
    }
    /**
     * Clear all memory
     */
    async clear() {
        const count = this.memory.size;
        this.memory.clear();
        this.logger.info(`Cleared ${count} entries from memory`);
    }
    /**
     * Get memory usage statistics
     */
    getStats() {
        const totalSizeBytes = this.getMemoryUsageBytes();
        const totalSizeMB = totalSizeBytes / 1024 / 1024;
        return {
            entries: this.memory.size,
            totalSizeBytes,
            totalSizeMB,
            maxSizeMB: this.MAX_MEMORY_MB,
            utilizationPercent: (totalSizeMB / this.MAX_MEMORY_MB) * 100
        };
    }
    /**
     * Get total memory usage in bytes
     */
    getMemoryUsageBytes() {
        let total = 0;
        for (const entry of this.memory.values()) {
            total += entry.sizeBytes;
        }
        return total;
    }
    /**
     * Clean up expired entries
     */
    cleanupExpired() {
        const now = new Date();
        let removed = 0;
        for (const [key, entry] of this.memory.entries()) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.memory.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            this.logger.debug(`Cleaned up ${removed} expired entries`);
        }
    }
    /**
     * Persist memory to disk for recovery
     */
    async persistToDisk() {
        try {
            const data = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                entries: Array.from(this.memory.entries()).map(([key, entry]) => ({
                    key,
                    value: entry.value,
                    timestamp: entry.timestamp,
                    expiresAt: entry.expiresAt,
                    sizeBytes: entry.sizeBytes
                }))
            };
            await fs.promises.writeFile(this.PERSIST_FILE, JSON.stringify(data, null, 2), 'utf-8');
            this.logger.debug(`Persisted ${this.memory.size} entries to disk`);
        }
        catch (error) {
            this.logger.error('Failed to persist memory to disk:', error);
        }
    }
    /**
     * Load memory from disk
     */
    loadFromDisk() {
        try {
            if (!fs.existsSync(this.PERSIST_FILE)) {
                return;
            }
            const data = JSON.parse(fs.readFileSync(this.PERSIST_FILE, 'utf-8'));
            if (data.version !== '1.0') {
                this.logger.warn('Incompatible memory snapshot version, skipping load');
                return;
            }
            for (const entry of data.entries) {
                this.memory.set(entry.key, {
                    key: entry.key,
                    value: entry.value,
                    timestamp: new Date(entry.timestamp),
                    expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : undefined,
                    sizeBytes: entry.sizeBytes
                });
            }
            this.cleanupExpired();
            this.logger.info(`Loaded ${this.memory.size} entries from disk`);
        }
        catch (error) {
            this.logger.error('Failed to load memory from disk:', error);
        }
    }
    /**
     * Start auto-persist timer
     */
    startAutoPersist() {
        // Persist every 30 seconds
        this.persistTimer = setInterval(() => {
            this.persistToDisk().catch(error => {
                this.logger.error('Auto-persist failed:', error);
            });
        }, 30000);
        // Don't block process exit
        if (this.persistTimer.unref) {
            this.persistTimer.unref();
        }
        // Persist on exit
        process.on('beforeExit', () => {
            this.persistToDisk();
        });
    }
    /**
     * Stop auto-persist timer
     */
    destroy() {
        if (this.persistTimer) {
            clearInterval(this.persistTimer);
            this.persistTimer = null;
        }
        this.persistToDisk();
    }
}
exports.ReliableMemoryManager = ReliableMemoryManager;
// Export singleton instance
exports.reliableMemory = ReliableMemoryManager.getInstance();
//# sourceMappingURL=reliable-memory-manager.js.map