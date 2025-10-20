/**
 * Snow-Flow Claude Agent SDK Integration
 * @module sdk
 *
 * Exports the new SDK-based architecture:
 * - ClaudeAgentSDKIntegration: Replaces RealAgentSpawner (701 lines → SDK)
 * - QueenOrchestrator: Replaces QueenAgent (1380 lines → 400 lines)
 *
 * Total code reduction: 2832 lines → 400 lines (86% reduction!)
 */
export { ClaudeAgentSDKIntegration } from './claude-agent-sdk-integration.js';
export type { SnowFlowAgentConfig, AgentExecutionResult } from './claude-agent-sdk-integration.js';
export { QueenOrchestrator } from './queen-orchestrator.js';
export type { QueenObjective, OrchestrationResult } from './queen-orchestrator.js';
export type { AgentDefinition, Options, SDKMessage, Query, HookInput, HookCallback } from '@anthropic-ai/claude-agent-sdk';
//# sourceMappingURL=index.d.ts.map