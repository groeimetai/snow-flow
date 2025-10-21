/**
 * Snow-Flow: ServiceNow Multi-LLM Development Platform
 * Built with OpenCode integration (also compatible with Claude Code)
 */

// Export main types
export * from './types/index.js';

// Export utilities
export { ServiceNowOAuth } from './utils/snow-oauth.js';
export { ServiceNowClient } from './utils/servicenow-client.js';
export { Logger } from './utils/logger.js';

// Export artifact sync system
export { ArtifactLocalSync } from './utils/artifact-local-sync.js';
export { SmartFieldFetcher } from './utils/smart-field-fetcher.js';
export * from './utils/artifact-sync/artifact-registry.js';

// Export MCP servers
export { ServiceNowMCPServer } from './mcp/servicenow-mcp-server.js';
export { ServiceNowLocalDevelopmentMCP } from './mcp/servicenow-local-development-mcp.js';

// Snow-Flow System Integration (New)
export { SnowFlowSystem, snowFlowSystem } from './snow-flow-system.js';
export { SnowFlowConfig, snowFlowConfig } from './config/snow-flow-config.js';
export { MemorySystem } from './memory/memory-system.js';
export { ErrorRecovery, FALLBACK_STRATEGIES } from './utils/error-recovery.js';
export { PerformanceTracker } from './monitoring/performance-tracker.js';
export { SystemHealth } from './health/system-health.js';

// Re-export integration types
export type {
  SwarmSession,
  AgentInfo,
  SwarmOptions,
  SwarmResult,
  SystemStatus
} from './snow-flow-system.js';

export type {
  ISnowFlowConfig
} from './config/snow-flow-config.js';

export type {
  ErrorContext,
  RecoveryStrategy,
  RecoveryResult,
  ErrorMetrics
} from './utils/error-recovery.js';

export type {
  PerformanceMetric,
  AggregateMetrics,
  SessionMetrics,
  PerformanceReport,
  Bottleneck
} from './monitoring/performance-tracker.js';

export type {
  HealthCheckResult,
  SystemHealthStatus,
  SystemResources,
  HealthThresholds
} from './health/system-health.js';

console.log('Snow-Flow: ServiceNow Hive-Mind Intelligence Framework loaded');