"use strict";
/**
 * ServiceNow Queen Memory System - JSON-based implementation
 * Simple JSON file storage for the hive-mind - no more SQLite permission issues!
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
exports.QueenMemorySystem = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class QueenMemorySystem {
    constructor(dbPath) {
        this.SAVE_DELAY = 1000; // Debounce saves by 1 second
        // Use same directory structure but with JSON files
        this.memoryDir = path.dirname(dbPath || path.join(process.cwd(), '.snow-flow', 'queen', 'memory'));
        // Ensure directory exists
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
        // Load or initialize storage
        this.storage = this.loadStorage();
        // Convert storage to memory format
        this.memory = this.convertStorageToMemory();
    }
    getFilePath(filename) {
        return path.join(this.memoryDir, filename);
    }
    loadStorage() {
        const files = {
            patterns: this.getFilePath('patterns.json'),
            artifacts: this.getFilePath('artifacts.json'),
            learnings: this.getFilePath('learnings.json'),
            context: this.getFilePath('context.json'),
            taskHistory: this.getFilePath('task-history.json')
        };
        const storage = {
            patterns: [],
            artifacts: {},
            learnings: {},
            context: {},
            taskHistory: []
        };
        // Load patterns
        if (fs.existsSync(files.patterns)) {
            try {
                const data = fs.readFileSync(files.patterns, 'utf-8');
                storage.patterns = JSON.parse(data);
                // Convert date strings back to Date objects
                storage.patterns.forEach(p => {
                    p.lastUsed = new Date(p.lastUsed);
                });
            }
            catch (error) {
                console.warn('⚠️ Could not load patterns.json:', error);
            }
        }
        // Load artifacts
        if (fs.existsSync(files.artifacts)) {
            try {
                const data = fs.readFileSync(files.artifacts, 'utf-8');
                storage.artifacts = JSON.parse(data);
            }
            catch (error) {
                console.warn('⚠️ Could not load artifacts.json:', error);
            }
        }
        // Load learnings
        if (fs.existsSync(files.learnings)) {
            try {
                const data = fs.readFileSync(files.learnings, 'utf-8');
                storage.learnings = JSON.parse(data);
            }
            catch (error) {
                console.warn('⚠️ Could not load learnings.json:', error);
            }
        }
        // Load context
        if (fs.existsSync(files.context)) {
            try {
                const data = fs.readFileSync(files.context, 'utf-8');
                storage.context = JSON.parse(data);
            }
            catch (error) {
                console.warn('⚠️ Could not load context.json:', error);
            }
        }
        // Load task history
        if (fs.existsSync(files.taskHistory)) {
            try {
                const data = fs.readFileSync(files.taskHistory, 'utf-8');
                storage.taskHistory = JSON.parse(data);
            }
            catch (error) {
                console.warn('⚠️ Could not load task-history.json:', error);
            }
        }
        return storage;
    }
    convertStorageToMemory() {
        const artifacts = new Map();
        Object.entries(this.storage.artifacts).forEach(([key, value]) => {
            artifacts.set(key, value);
        });
        const learnings = new Map();
        Object.entries(this.storage.learnings).forEach(([key, value]) => {
            learnings.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
        return {
            patterns: this.storage.patterns,
            artifacts,
            agentHistory: new Map(),
            learnings
        };
    }
    scheduleSave() {
        // Debounce saves to avoid excessive file writes
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(() => {
            this.saveAll();
        }, this.SAVE_DELAY);
    }
    saveAll() {
        // Save patterns
        this.saveJSON('patterns.json', this.storage.patterns);
        // Save artifacts
        this.saveJSON('artifacts.json', this.storage.artifacts);
        // Save learnings
        this.saveJSON('learnings.json', this.storage.learnings);
        // Save context
        this.saveJSON('context.json', this.storage.context);
        // Save task history
        this.saveJSON('task-history.json', this.storage.taskHistory);
    }
    saveJSON(filename, data) {
        const filepath = this.getFilePath(filename);
        try {
            // Write to temp file first for atomicity
            const tempPath = filepath + '.tmp';
            fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
            // Atomic rename
            fs.renameSync(tempPath, filepath);
        }
        catch (error) {
            console.error(`❌ Failed to save ${filename}:`, error);
        }
    }
    // Store successful deployment pattern
    storePattern(pattern) {
        // Update or add pattern
        const existingIndex = this.storage.patterns.findIndex(p => p.taskType === pattern.taskType);
        if (existingIndex >= 0) {
            // Update existing pattern
            const existing = this.storage.patterns[existingIndex];
            existing.successRate = pattern.successRate;
            existing.agentSequence = pattern.agentSequence;
            existing.mcpSequence = pattern.mcpSequence;
            existing.avgDuration = pattern.avgDuration;
            existing.lastUsed = pattern.lastUsed;
            existing.useCount = (existing.useCount || 0) + 1;
        }
        else {
            // Add new pattern
            this.storage.patterns.push({
                ...pattern,
                useCount: 1
            });
        }
        // Update memory
        this.memory.patterns = this.storage.patterns;
        // Schedule save
        this.scheduleSave();
    }
    // Get best pattern for task type
    getBestPattern(taskType) {
        return this.memory.patterns.find(p => p.taskType === taskType) || null;
    }
    // Store artifact information
    storeArtifact(artifact) {
        const id = `${artifact.type}_${artifact.name}`;
        // Store in both storage and memory
        this.storage.artifacts[id] = artifact;
        this.memory.artifacts.set(id, artifact);
        // Schedule save
        this.scheduleSave();
    }
    // Find similar artifacts
    findSimilarArtifacts(type, namePattern) {
        const results = [];
        for (const [id, artifact] of Array.from(this.memory.artifacts.entries())) {
            if (artifact.type === type && artifact.name.toLowerCase().includes(namePattern.toLowerCase())) {
                results.push(artifact);
            }
        }
        return results;
    }
    // Store learning from task execution
    storeLearning(key, value, confidence = 1.0) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        // Store with metadata
        this.storage.learnings[key] = {
            value: valueStr,
            confidence,
            updatedAt: new Date().toISOString()
        };
        // Update memory
        this.memory.learnings.set(key, valueStr);
        // Schedule save
        this.scheduleSave();
    }
    // Get learning
    getLearning(key) {
        const value = this.memory.learnings.get(key);
        if (!value)
            return null;
        // Try to parse JSON if it looks like JSON
        try {
            if (value.startsWith('{') || value.startsWith('[')) {
                return JSON.parse(value);
            }
        }
        catch {
            // If parsing fails, return as string
        }
        return value;
    }
    // Record task completion for learning
    recordTaskCompletion(taskId, objective, type, agentsUsed, success, duration) {
        const entry = {
            id: taskId,
            objective,
            type,
            agentsUsed,
            success,
            duration,
            completedAt: new Date().toISOString()
        };
        // Add to history
        this.storage.taskHistory.push(entry);
        // Keep only last 1000 entries to prevent unbounded growth
        if (this.storage.taskHistory.length > 1000) {
            this.storage.taskHistory = this.storage.taskHistory.slice(-1000);
        }
        // Schedule save
        this.scheduleSave();
    }
    // Get success rate for task type
    getSuccessRate(taskType) {
        const relevantTasks = this.storage.taskHistory.filter(t => t.type === taskType);
        if (relevantTasks.length === 0) {
            return 0.5; // Default success rate
        }
        const successes = relevantTasks.filter(t => t.success).length;
        return successes / relevantTasks.length;
    }
    // Export memory for backup
    exportMemory() {
        return JSON.stringify({
            patterns: this.storage.patterns,
            artifacts: Object.entries(this.storage.artifacts),
            learnings: Object.entries(this.storage.learnings),
            context: Object.entries(this.storage.context),
            taskHistory: this.storage.taskHistory
        }, null, 2);
    }
    // Import memory from backup
    importMemory(memoryData) {
        try {
            const data = JSON.parse(memoryData);
            // Import patterns
            if (data.patterns) {
                this.storage.patterns = data.patterns.map((p) => ({
                    ...p,
                    lastUsed: new Date(p.lastUsed)
                }));
            }
            // Import artifacts
            if (data.artifacts) {
                this.storage.artifacts = {};
                data.artifacts.forEach(([key, value]) => {
                    this.storage.artifacts[key] = value;
                });
            }
            // Import learnings
            if (data.learnings) {
                this.storage.learnings = {};
                data.learnings.forEach(([key, value]) => {
                    this.storage.learnings[key] = value;
                });
            }
            // Import context
            if (data.context) {
                this.storage.context = {};
                data.context.forEach(([key, value]) => {
                    this.storage.context[key] = value;
                });
            }
            // Import task history
            if (data.taskHistory) {
                this.storage.taskHistory = data.taskHistory;
            }
            // Update memory from storage
            this.memory = this.convertStorageToMemory();
            // Save all
            this.saveAll();
        }
        catch (error) {
            throw new Error(`Failed to import memory: ${error.message}`);
        }
    }
    // Clear all memory (reset learning)
    clearMemory() {
        // Reset storage
        this.storage = {
            patterns: [],
            artifacts: {},
            learnings: {},
            context: {},
            taskHistory: []
        };
        // Reset memory
        this.memory = {
            patterns: [],
            artifacts: new Map(),
            agentHistory: new Map(),
            learnings: new Map()
        };
        // Save empty state
        this.saveAll();
    }
    // Store data in context (key-value store)
    storeInContext(key, value) {
        this.storage.context[key] = value;
        this.scheduleSave();
    }
    // Get data from context
    getFromContext(key) {
        return this.storage.context[key] || null;
    }
    // Store generic data (alias for storeInContext for compatibility)
    store(key, value) {
        this.storeInContext(key, value);
    }
    // Get generic data (alias for getFromContext for compatibility)
    get(key) {
        return this.getFromContext(key);
    }
    // Get database path (for compatibility)
    getDbPath() {
        return this.memoryDir;
    }
    // Close database connection (no-op for JSON, but kept for compatibility)
    close() {
        // Save any pending changes
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveAll();
        }
    }
    // Additional methods needed by other components
    /**
     * Find similar patterns for a given task type
     */
    findSimilarPatterns(taskType) {
        return this.storage.patterns
            .filter(p => p.taskType.toLowerCase().includes(taskType.toLowerCase()))
            .sort((a, b) => {
            // Sort by success rate first, then by use count
            if (b.successRate !== a.successRate) {
                return b.successRate - a.successRate;
            }
            return (b.useCount || 0) - (a.useCount || 0);
        })
            .slice(0, 5);
    }
    /**
     * Store a decision made by the Queen
     */
    storeDecision(taskId, decision) {
        this.storeInContext(`decision_${taskId}`, {
            ...decision,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Find the best pattern for a task type
     */
    findBestPattern(taskType) {
        const patterns = this.findSimilarPatterns(taskType);
        return patterns.length > 0 ? patterns[0] : null;
    }
    /**
     * Get memory statistics
     */
    getStats() {
        const stats = {
            patterns: this.storage.patterns.length,
            artifacts: Object.keys(this.storage.artifacts).length,
            tasks: this.storage.taskHistory.length,
            learnings: Object.keys(this.storage.learnings).length,
            databaseSize: 0
        };
        // Calculate total file sizes
        const files = ['patterns.json', 'artifacts.json', 'learnings.json', 'context.json', 'task-history.json'];
        for (const file of files) {
            const filepath = this.getFilePath(file);
            if (fs.existsSync(filepath)) {
                stats.databaseSize += fs.statSync(filepath).size;
            }
        }
        return stats;
    }
    /**
     * Store progress information
     */
    storeProgress(agentId, progress) {
        this.storeInContext(`progress_${agentId}`, progress);
    }
    /**
     * Get progress information
     */
    getProgress(agentId) {
        return this.getFromContext(`progress_${agentId}`);
    }
    /**
     * Store failure pattern for learning
     */
    storeFailurePattern(pattern) {
        const key = `failure_${Date.now()}`;
        this.storeLearning(key, pattern, 0.8);
    }
}
exports.QueenMemorySystem = QueenMemorySystem;
//# sourceMappingURL=queen-memory.js.map