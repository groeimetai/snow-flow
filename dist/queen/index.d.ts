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
export { ServiceNowQueen, QueenConfig } from './servicenow-queen';
export { QueenMemorySystem } from './queen-memory';
export { NeuralLearning } from './neural-learning';
export { AgentFactory } from './agent-factory';
export { ServiceNowTask, Agent, AgentType, TaskAnalysis, DeploymentPattern, QueenMemory, AgentMessage, ServiceNowArtifact } from './types';
import { ServiceNowQueen } from './servicenow-queen';
/**
 * Quick start factory function
 */
export declare function createServiceNowQueen(options?: {
    memoryPath?: string;
    debugMode?: boolean;
    maxConcurrentAgents?: number;
    autoPermissions?: boolean;
}): ServiceNowQueen;
/**
 * Available agent types for dynamic spawning
 */
export declare const AVAILABLE_AGENT_TYPES: readonly ["widget-creator", "flow-builder", "script-writer", "app-architect", "integration-specialist", "catalog-manager", "researcher", "tester"];
/**
 * Common ServiceNow task patterns
 */
export declare const TASK_PATTERNS: {
    readonly WIDGET: {
        readonly keywords: readonly ["widget", "dashboard", "chart", "display", "portal"];
        readonly complexity_factors: readonly ["chart", "responsive", "data_sources", "real_time"];
    };
    readonly FLOW: {
        readonly keywords: readonly ["flow", "workflow", "process", "approval", "automation"];
        readonly complexity_factors: readonly ["approval_steps", "integration", "conditions", "notifications"];
    };
    readonly APPLICATION: {
        readonly keywords: readonly ["application", "app", "system", "module", "solution"];
        readonly complexity_factors: readonly ["tables", "business_rules", "ui_policies", "integrations"];
    };
    readonly INTEGRATION: {
        readonly keywords: readonly ["integration", "api", "connect", "sync", "import", "export"];
        readonly complexity_factors: readonly ["external_apis", "data_transformation", "authentication", "error_handling"];
    };
};
//# sourceMappingURL=index.d.ts.map