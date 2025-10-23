/**
 * ServiceNow Agent System - Claude Agent SDK Integration v4.7.0
 * DEPRECATED: Custom agents replaced by @anthropic-ai/claude-agent-sdk@0.1.1
 */

// Re-export SDK components for backward compatibility
export { ClaudeAgentSDKIntegration } from '../sdk/index.js';
export type { SnowFlowAgentConfig, AgentExecutionResult, AgentType } from '../sdk/index.js';

// SDK-based agent system:
// - Agents are spawned via ClaudeAgentSDKIntegration
// - Queen orchestration deprecated (use swarm command instead)