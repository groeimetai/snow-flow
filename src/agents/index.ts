/**
 * ServiceNow Agent System - Claude Agent SDK Integration v4.7.0
 * DEPRECATED: Custom agents replaced by @anthropic-ai/claude-agent-sdk@0.1.1
 */

// Re-export SDK components for backward compatibility
export { ClaudeAgentSDKIntegration, QueenOrchestrator } from '../sdk/index.js';
export type { SnowFlowAgentConfig, AgentExecutionResult, QueenObjective, OrchestrationResult } from '../sdk/index.js';

// SDK-based agent system:
// - Agents are spawned via ClaudeAgentSDKIntegration
// - Queen intelligence via QueenOrchestrator
// - 86% code reduction (2832 → 400 lines)