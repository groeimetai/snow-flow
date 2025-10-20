"use strict";
/**
 * ServiceNow Queen Agent - Hive-Mind Intelligence System
 *
 * Simple, elegant coordination system following snow-flow philosophy
 *
 * @example
 * ```typescript
 * import { ServiceNowQueen } from './queen';
 *
 * const queen = new ServiceNowQueen({
 *   debugMode: true,
 *   maxConcurrentAgents: 5
 * });
 *
 * // Execute any ServiceNow objective
 * const result = await queen.executeObjective("create incident dashboard with charts");
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_PATTERNS = exports.AVAILABLE_AGENT_TYPES = exports.AgentFactory = exports.NeuralLearning = exports.QueenMemorySystem = exports.ServiceNowQueen = void 0;
exports.createServiceNowQueen = createServiceNowQueen;
// Main Queen Agent
var servicenow_queen_1 = require("./servicenow-queen");
Object.defineProperty(exports, "ServiceNowQueen", { enumerable: true, get: function () { return servicenow_queen_1.ServiceNowQueen; } });
// Core components
var queen_memory_1 = require("./queen-memory");
Object.defineProperty(exports, "QueenMemorySystem", { enumerable: true, get: function () { return queen_memory_1.QueenMemorySystem; } });
var neural_learning_1 = require("./neural-learning");
Object.defineProperty(exports, "NeuralLearning", { enumerable: true, get: function () { return neural_learning_1.NeuralLearning; } });
var agent_factory_1 = require("./agent-factory");
Object.defineProperty(exports, "AgentFactory", { enumerable: true, get: function () { return agent_factory_1.AgentFactory; } });
// Import for internal use
const servicenow_queen_2 = require("./servicenow-queen");
/**
 * Quick start factory function
 */
function createServiceNowQueen(options = {}) {
    return new servicenow_queen_2.ServiceNowQueen({
        debugMode: options.debugMode ?? process.env.NODE_ENV === 'development',
        memoryPath: options.memoryPath,
        maxConcurrentAgents: options.maxConcurrentAgents ?? 5,
        autoPermissions: options.autoPermissions ?? false
    });
}
/**
 * Available agent types for dynamic spawning
 */
exports.AVAILABLE_AGENT_TYPES = [
    'widget-creator',
    'flow-builder',
    'script-writer',
    'app-architect',
    'integration-specialist',
    'catalog-manager',
    'researcher',
    'tester'
];
/**
 * Common ServiceNow task patterns
 */
exports.TASK_PATTERNS = {
    WIDGET: {
        keywords: ['widget', 'dashboard', 'chart', 'display', 'portal'],
        complexity_factors: ['chart', 'responsive', 'data_sources', 'real_time']
    },
    FLOW: {
        keywords: ['flow', 'workflow', 'process', 'approval', 'automation'],
        complexity_factors: ['approval_steps', 'integration', 'conditions', 'notifications']
    },
    APPLICATION: {
        keywords: ['application', 'app', 'system', 'module', 'solution'],
        complexity_factors: ['tables', 'business_rules', 'ui_policies', 'integrations']
    },
    INTEGRATION: {
        keywords: ['integration', 'api', 'connect', 'sync', 'import', 'export'],
        complexity_factors: ['external_apis', 'data_transformation', 'authentication', 'error_handling']
    }
};
//# sourceMappingURL=index.js.map