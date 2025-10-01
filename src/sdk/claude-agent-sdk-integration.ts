/**
 * Claude Agent SDK Integration Layer
 * Bridges Snow-Flow architecture with @anthropic-ai/claude-agent-sdk@0.1.1
 *
 * Purpose:
 * - Replace custom RealAgentSpawner with SDK's native agent spawning
 * - Integrate SDK's query() with our Memory System
 * - Provide hooks for agent coordination
 * - Simplify agent execution while keeping our intelligence
 */

import { query, type AgentDefinition, type Options, type SDKMessage, type Query } from '@anthropic-ai/claude-agent-sdk';
import { MemorySystem } from '../memory/memory-system.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import type { AgentType } from '../queen/types.js';

export interface SnowFlowAgentConfig {
  type: AgentType;
  objective: string;
  context?: Record<string, any>;
  mcpTools?: string[];
  memory?: MemorySystem;
  maxTurns?: number;
  model?: 'sonnet' | 'opus' | 'haiku';
}

export interface AgentExecutionResult {
  success: boolean;
  agentId: string;
  agentType: AgentType;
  artifacts: string[]; // sys_ids created in ServiceNow
  output: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  duration: number;
  error?: Error;
}

/**
 * Snow-Flow SDK Integration
 * Replaces 2800+ lines of custom agent code with SDK-native approach
 */
export class ClaudeAgentSDKIntegration extends EventEmitter {
  private memory: MemorySystem;
  private logger: Logger;
  private activeQueries: Map<string, Query> = new Map();

  constructor(memory: MemorySystem) {
    super();
    this.memory = memory;
    this.logger = new Logger('ClaudeAgentSDK');
  }

  /**
   * Spawn agent using Claude Agent SDK (replaces RealAgentSpawner)
   *
   * Before: 701 lines in RealAgentSpawner
   * After: Single query() call with proper instructions
   */
  async spawnAgent(config: SnowFlowAgentConfig): Promise<AgentExecutionResult> {
    const agentId = this.generateAgentId(config.type);
    const startTime = Date.now();

    this.logger.info(`🚀 Spawning ${config.type} agent via Claude Agent SDK`);
    this.emit('agent:spawning', { agentId, type: config.type });

    try {
      // Build agent instructions with Snow-Flow context
      const instructions = this.buildAgentInstructions(config);

      // Configure SDK options with MCP servers and hooks
      const options: Options = {
        mcpServers: this.buildMCPServerConfig(),
        hooks: this.buildHooks(agentId, config.type),
        maxTurns: config.maxTurns || 10,
        model: this.mapModelName(config.model),
        permissionMode: 'bypassPermissions', // For automated agents
        cwd: process.cwd()
      };

      // Execute agent via SDK query()
      const agentQuery = query({
        prompt: instructions,
        options
      });

      // Store active query for monitoring/control
      this.activeQueries.set(agentId, agentQuery);

      // Process agent execution
      const result = await this.processAgentExecution(
        agentId,
        config.type,
        agentQuery,
        startTime
      );

      this.emit('agent:completed', result);
      return result;

    } catch (error) {
      this.logger.error(`❌ Agent ${agentId} failed:`, error);
      this.emit('agent:failed', { agentId, type: config.type, error });

      return {
        success: false,
        agentId,
        agentType: config.type,
        artifacts: [],
        output: '',
        tokensUsed: { input: 0, output: 0, total: 0 },
        duration: Date.now() - startTime,
        error: error as Error
      };
    } finally {
      this.activeQueries.delete(agentId);
    }
  }

  /**
   * Spawn multiple agents in parallel
   * Leverages our ParallelAgentEngine intelligence + SDK execution
   */
  async spawnParallelAgents(
    configs: SnowFlowAgentConfig[]
  ): Promise<AgentExecutionResult[]> {
    this.logger.info(`🚀 Spawning ${configs.length} agents in parallel`);

    const spawnPromises = configs.map(config => this.spawnAgent(config));
    const results = await Promise.allSettled(spawnPromises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const config = configs[index];
        return {
          success: false,
          agentId: this.generateAgentId(config.type),
          agentType: config.type,
          artifacts: [],
          output: '',
          tokensUsed: { input: 0, output: 0, total: 0 },
          duration: 0,
          error: result.reason as Error
        };
      }
    });
  }

  /**
   * Build agent instructions with Snow-Flow intelligence
   * Maps agent types to clear, actionable instructions
   */
  private buildAgentInstructions(config: SnowFlowAgentConfig): string {
    const baseInstructions = `You are a ${config.type} agent in the Snow-Flow intelligent orchestration system.

**Agent ID:** ${this.generateAgentId(config.type)}
**Objective:** ${config.objective}
**Available MCP Tools:** All 448 ServiceNow unified tools are available

## 🎯 Mission

${this.getTypeSpecificInstructions(config.type)}

## 📋 Execution Requirements

1. **Use REAL Snow-Flow MCP tools:**
   - All tools are prefixed with 'snow_' (e.g., snow_create_workspace, snow_create_uib_page)
   - Execute tools with proper parameters
   - Capture sys_ids from responses

2. **Store results in Memory:**
   - Use mcp__claude-flow__memory_usage for coordination
   - Store all created artifacts: \`memory_usage({ action: 'store', key: 'agent_work_${this.generateAgentId(config.type)}', value: JSON.stringify({ sys_ids: [...] }) })\`
   - Share findings with other agents through Memory

3. **Verify your work:**
   - After creating artifacts, verify they exist in ServiceNow
   - Use snow_query_table to confirm records exist
   - Report only verified work

4. **Track Update Set:**
   - Ensure active Update Set: snow_ensure_active_update_set
   - All changes should be tracked

## ⚠️ Critical Rules

- ❌ NO simulation or fake responses
- ❌ NO placeholder sys_ids
- ✅ ONLY report verified ServiceNow artifacts
- ✅ USE Memory for agent coordination
- ✅ VERIFY all work via snow_query_table

## 🚀 Begin Execution

${config.context ? `\n**Context:**\n${JSON.stringify(config.context, null, 2)}\n` : ''}

Execute your mission now. Use TodoWrite to break down tasks if needed.`;

    return baseInstructions;
  }

  /**
   * Type-specific instructions for different agent types
   */
  private getTypeSpecificInstructions(type: AgentType): string {
    const instructions: Record<string, string> = {
      'workspace-specialist': `Create and configure ServiceNow workspaces using:
- snow_create_complete_workspace for full UX Framework workspaces
- snow_create_configurable_agent_workspace for Agent Workspaces
- snow_discover_all_workspaces to check existing workspaces
- snow_validate_workspace_configuration to ensure proper setup`,

      'ui-builder-expert': `Build UI Builder pages and components using:
- snow_create_uib_page for new pages
- snow_add_uib_page_element to add components
- snow_create_uib_component for custom components
- snow_create_uib_data_broker for data integration
- Ensure proper routing and data flow`,

      'widget-creator': `Create Service Portal widgets using:
- snow_create_sp_widget for new widgets
- Ensure HTML/Client/Server script coherence
- Use snow_pull_artifact for debugging large widgets
- Validate with snow_validate_artifact_coherence`,

      'script-writer': `Write and deploy scripts using:
- snow_create_script_include for reusable code
- snow_create_business_rule for automation
- snow_create_client_script for client-side logic
- Ensure ES5 compatibility (NO modern JavaScript!)
- Test with snow_execute_script_with_output`,

      'integration-specialist': `Build integrations using:
- snow_create_rest_message for REST APIs
- snow_test_rest_connection for validation
- snow_create_transform_map for data transformation
- Handle authentication and error cases`,

      'tester': `Test and validate implementations using:
- snow_execute_script_with_output for functionality tests
- snow_get_logs for error checking
- snow_validate_artifact_coherence for widget testing
- Create comprehensive test scenarios`,

      'security-specialist': `Ensure security and compliance using:
- snow_create_acl for access control
- snow_scan_vulnerabilities for security checks
- Review permissions and authentication
- Validate data access patterns`,

      'deployment-specialist': `Deploy and validate artifacts using:
- snow_deploy for widget/artifact deployment
- snow_ensure_active_update_set for change tracking
- snow_validate_deployment for verification
- Handle rollback if needed`,

      'researcher': `Research and analyze ServiceNow environments using:
- snow_comprehensive_search for artifact discovery
- snow_discover_* tools for exploring configurations
- snow_query_table for data analysis
- Document findings in Memory`,

      'app-architect': `Design application architecture using:
- Analyze requirements and design data models
- Plan UI/UX structure
- Define integration points
- Document architecture in Memory for other agents`,

      'page-designer': `Design and create portal pages using:
- snow_create_sp_page for Service Portal pages
- Configure layout (containers, rows, columns)
- Place widgets with proper sizing
- Set permissions and navigation`
    };

    return instructions[type] || `Execute your specialized task: ${type}`;
  }

  /**
   * Build MCP server configuration for SDK
   * Connects to our 448-tool unified server
   */
  private buildMCPServerConfig(): Record<string, any> {
    return {
      'servicenow-unified': {
        type: 'stdio',
        command: 'node',
        args: [
          'dist/mcp/servicenow-mcp-unified/index.js'
        ],
        env: process.env
      },
      'claude-flow': {
        type: 'stdio',
        command: 'npx',
        args: ['claude-flow@alpha', 'mcp', 'start'],
        env: process.env
      }
    };
  }

  /**
   * Build hooks for agent coordination
   * Integrates with our Memory System and progress tracking
   */
  private buildHooks(agentId: string, agentType: AgentType): Options['hooks'] {
    return {
      PostToolUse: [{
        hooks: [async (input, toolUseId, { signal }) => {
          // Type guard for PostToolUseHookInput
          if (input.hook_event_name !== 'PostToolUse') {
            return { continue: true };
          }

          // Store tool execution in Memory for coordination
          if (input.tool_name.startsWith('snow_')) {
            await this.memory.store(`agent_tool_${agentId}_${toolUseId}`, {
              agentId,
              agentType,
              toolName: input.tool_name,
              toolInput: input.tool_input,
              toolResponse: input.tool_response,
              timestamp: new Date().toISOString()
            });

            this.emit('agent:tool-used', {
              agentId,
              agentType,
              toolName: input.tool_name
            });
          }

          return { continue: true };
        }]
      }],

      SessionEnd: [{
        hooks: [async (input, toolUseId, { signal }) => {
          // Type guard for SessionEndHookInput
          if (input.hook_event_name !== 'SessionEnd') {
            return { continue: true };
          }

          // Store final session results
          await this.memory.store(`agent_session_${agentId}`, {
            agentId,
            agentType,
            reason: input.reason,
            timestamp: new Date().toISOString()
          });

          this.logger.info(`✅ Agent ${agentId} session ended: ${input.reason}`);
          return { continue: true };
        }]
      }]
    };
  }

  /**
   * Process agent execution stream
   * Extracts artifacts, tokens, and output
   */
  private async processAgentExecution(
    agentId: string,
    agentType: AgentType,
    agentQuery: Query,
    startTime: number
  ): Promise<AgentExecutionResult> {
    const artifacts: string[] = [];
    let output = '';
    let tokensUsed = { input: 0, output: 0, total: 0 };

    try {
      // Stream agent messages
      for await (const message of agentQuery) {
        this.emit('agent:message', { agentId, message });

        // Extract results from completion
        if (message.type === 'result' && message.subtype === 'success') {
          output = message.result;
          tokensUsed = {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
            total: message.usage.input_tokens + message.usage.output_tokens
          };
        }

        // Extract artifacts from tool responses
        if (message.type === 'assistant') {
          const content = message.message.content;
          for (const block of content) {
            if (block.type === 'tool_use') {
              // Look for sys_ids in tool results
              const sysIdMatch = JSON.stringify(block).match(/[a-f0-9]{32}/g);
              if (sysIdMatch) {
                artifacts.push(...sysIdMatch);
              }
            }
          }
        }
      }

      // Store final results in Memory
      await this.memory.store(`agent_result_${agentId}`, {
        agentId,
        agentType,
        success: true,
        artifacts: [...new Set(artifacts)], // Remove duplicates
        output,
        tokensUsed,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        agentId,
        agentType,
        artifacts: [...new Set(artifacts)],
        output,
        tokensUsed,
        duration: Date.now() - startTime
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Control running agent (interrupt, change model, etc.)
   */
  async controlAgent(agentId: string, action: 'interrupt' | 'pause'): Promise<void> {
    const query = this.activeQueries.get(agentId);
    if (!query) {
      throw new Error(`Agent ${agentId} not found or already completed`);
    }

    if (action === 'interrupt') {
      await query.interrupt();
      this.logger.info(`⏸️ Agent ${agentId} interrupted`);
    }
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): 'active' | 'completed' | 'not-found' {
    if (this.activeQueries.has(agentId)) {
      return 'active';
    }

    // Check Memory for completed agents
    const result = this.memory.get(`agent_result_${agentId}`);
    return result ? 'completed' : 'not-found';
  }

  /**
   * Utility methods
   */
  private generateAgentId(type: AgentType): string {
    return `sdk_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapModelName(model?: 'sonnet' | 'opus' | 'haiku'): string | undefined {
    if (!model) return undefined;

    const modelMap = {
      'sonnet': 'claude-3-5-sonnet-20241022',
      'opus': 'claude-3-opus-20240229',
      'haiku': 'claude-3-5-haiku-20241022'
    };

    return modelMap[model];
  }

  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    // Interrupt all active agents
    for (const [agentId, query] of this.activeQueries.entries()) {
      try {
        await query.interrupt();
        this.logger.info(`⏹️ Interrupted agent ${agentId}`);
      } catch (error) {
        this.logger.error(`Failed to interrupt agent ${agentId}:`, error);
      }
    }

    this.activeQueries.clear();
    this.removeAllListeners();
  }
}
