"use strict";
/**
 * Snow-Flow Memory Patterns
 * Common memory patterns and utilities for Snow-Flow
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SNOW_FLOW_AGENT_CAPABILITIES = exports.SnowFlowMemoryOrganizer = exports.MEMORY_NAMESPACES = exports.MEMORY_PATTERNS = void 0;
exports.createMemoryKey = createMemoryKey;
exports.parseMemoryKey = parseMemoryKey;
exports.matchesPattern = matchesPattern;
exports.MEMORY_PATTERNS = {
    AGENT: 'agent/*',
    TASK: 'task/*',
    SESSION: 'session/*',
    ARTIFACT: 'artifact/*',
    CONFIG: 'config/*',
    TEMP: 'temp/*'
};
exports.MEMORY_NAMESPACES = {
    QUEEN: 'queen',
    AGENTS: 'agents',
    TASKS: 'tasks',
    SESSIONS: 'sessions',
    ARTIFACTS: 'artifacts',
    CONFIG: 'config',
    TEMP: 'temp'
};
function createMemoryKey(namespace, type, id) {
    return `${namespace}/${type}/${id}`;
}
function parseMemoryKey(key) {
    const parts = key.split('/');
    if (parts.length >= 3) {
        return {
            namespace: parts[0],
            type: parts[1],
            id: parts.slice(2).join('/')
        };
    }
    return null;
}
function matchesPattern(key, pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return regex.test(key);
}
// Export stub implementations for compatibility
class SnowFlowMemoryOrganizer {
    static organize(data) { return data; }
}
exports.SnowFlowMemoryOrganizer = SnowFlowMemoryOrganizer;
exports.SNOW_FLOW_AGENT_CAPABILITIES = {
    RESEARCHER: 'researcher',
    CODER: 'coder',
    ANALYST: 'analyst'
};
//# sourceMappingURL=snow-flow-memory-patterns.js.map