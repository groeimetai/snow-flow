"use strict";
/**
 * Agent Context Provider for MCP Operations
 * Provides agent context awareness and tracking for all MCP tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentContextProvider = void 0;
const mcp_memory_manager_js_1 = require("./mcp-memory-manager.js");
const logger_js_1 = require("../../utils/logger.js");
class AgentContextProvider {
    constructor() {
        this.memory = mcp_memory_manager_js_1.MCPMemoryManager.getInstance();
        this.logger = new logger_js_1.Logger('AgentContextProvider');
    }
    /**
     * Extract agent context from tool arguments or environment
     */
    extractAgentContext(args) {
        // Check if agent context is provided in args
        if (args.agent_context) {
            return args.agent_context;
        }
        // Check for session_id and agent_id in args
        if (args.session_id && args.agent_id) {
            return {
                session_id: args.session_id,
                agent_id: args.agent_id,
                agent_type: args.agent_type || 'unknown'
            };
        }
        // Check environment variables (for backward compatibility)
        const session_id = process.env.SNOW_FLOW_SESSION_ID || `session_${Date.now()}`;
        const agent_id = process.env.SNOW_FLOW_AGENT_ID || `agent_${Date.now()}`;
        const agent_type = process.env.SNOW_FLOW_AGENT_TYPE || 'mcp_direct';
        return {
            session_id,
            agent_id,
            agent_type
        };
    }
    /**
     * Execute an MCP operation with full agent context tracking
     */
    async executeWithContext(context, operation) {
        const startTime = Date.now();
        const { session_id, agent_id, operation_name } = context;
        try {
            // Update agent coordination - mark as active
            await this.memory.updateAgentCoordination({
                session_id,
                agent_id,
                agent_type: context.agent_type,
                status: 'active',
                current_tool: operation_name,
                progress_percentage: 0
            });
            // Execute the operation
            const result = await operation();
            const duration = Date.now() - startTime;
            // Track performance
            await this.memory.trackPerformance({
                session_id,
                agent_id,
                operation_name,
                duration_ms: duration,
                success: true
            });
            // Update progress
            await this.memory.updateAgentCoordination({
                session_id,
                agent_id,
                progress_percentage: 100,
                current_tool: null
            });
            return {
                success: true,
                data: result,
                duration_ms: duration
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Track failed operation
            await this.memory.trackPerformance({
                session_id,
                agent_id,
                operation_name,
                duration_ms: duration,
                success: false,
                error_message: errorMessage
            });
            // Update agent status with error
            await this.memory.updateAgentCoordination({
                session_id,
                agent_id,
                status: 'blocked',
                error_state: errorMessage,
                current_tool: null
            });
            return {
                success: false,
                error: errorMessage,
                duration_ms: duration
            };
        }
    }
    /**
     * Report progress during long-running operations
     */
    async reportProgress(context, progress, phase) {
        try {
            await this.memory.updateAgentCoordination({
                session_id: context.session_id,
                agent_id: context.agent_id,
                agent_type: context.agent_type,
                progress_percentage: Math.min(100, Math.max(0, progress)),
                current_tool: phase
            });
            // Optionally update shared context with detailed progress
            if (phase) {
                await this.memory.updateSharedContext({
                    session_id: context.session_id,
                    context_key: `${context.agent_id}_progress`,
                    context_value: JSON.stringify({
                        progress,
                        phase,
                        timestamp: new Date().toISOString()
                    }),
                    created_by_agent: context.agent_id
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to report progress', error);
        }
    }
    /**
     * Notify other agents of handoff or completion
     */
    async notifyHandoff(from_context, to_agent, artifact_info) {
        try {
            await this.memory.sendAgentMessage({
                session_id: from_context.session_id,
                from_agent: from_context.agent_id,
                to_agent,
                message_type: 'handoff',
                content: JSON.stringify({
                    artifact_type: artifact_info.type,
                    artifact_sys_id: artifact_info.sys_id,
                    next_steps: artifact_info.next_steps,
                    handoff_time: new Date().toISOString()
                }),
                artifact_reference: artifact_info.sys_id
            });
            // Update shared context for the handoff
            await this.memory.updateSharedContext({
                session_id: from_context.session_id,
                context_key: `${artifact_info.type}_ready_for_${to_agent}`,
                context_value: JSON.stringify({
                    sys_id: artifact_info.sys_id,
                    ready: true,
                    from_agent: from_context.agent_id,
                    next_steps: artifact_info.next_steps
                }),
                created_by_agent: from_context.agent_id
            });
            this.logger.info(`Notified handoff from ${from_context.agent_id} to ${to_agent}`);
        }
        catch (error) {
            this.logger.error('Failed to notify handoff', error);
            throw error;
        }
    }
    /**
     * Check for pending work from other agents
     */
    async checkForHandoffs(context) {
        try {
            const messages = await this.memory.checkForMessages(context.agent_id, context.session_id);
            const handoffs = messages
                .filter(m => m.message_type === 'handoff')
                .map(m => {
                try {
                    return JSON.parse(m.content);
                }
                catch {
                    return m.content;
                }
            });
            return handoffs;
        }
        catch (error) {
            this.logger.error('Failed to check for handoffs', error);
            return [];
        }
    }
    /**
     * Store artifact information with agent tracking
     */
    async storeArtifact(context, artifact) {
        try {
            await this.memory.storeArtifact({
                sys_id: artifact.sys_id,
                artifact_type: artifact.type,
                name: artifact.name,
                description: artifact.description,
                created_by_agent: context.agent_id,
                session_id: context.session_id,
                deployment_status: 'created',
                update_set_id: artifact.update_set_id,
                metadata: artifact.config ? JSON.stringify(artifact.config) : undefined
            });
            // Update shared context
            await this.memory.updateSharedContext({
                session_id: context.session_id,
                context_key: `${artifact.type}_${artifact.name}_created`,
                context_value: JSON.stringify({
                    sys_id: artifact.sys_id,
                    created_by: context.agent_id,
                    timestamp: new Date().toISOString()
                }),
                created_by_agent: context.agent_id
            });
            this.logger.info(`Stored artifact ${artifact.name} (${artifact.sys_id})`);
        }
        catch (error) {
            this.logger.error('Failed to store artifact', error);
            throw error;
        }
    }
    /**
     * Request Queen intervention for critical issues
     */
    async requestQueenIntervention(context, issue) {
        try {
            await this.memory.sendAgentMessage({
                session_id: context.session_id,
                from_agent: context.agent_id,
                to_agent: 'queen_agent',
                message_type: 'error',
                content: JSON.stringify({
                    issue_type: issue.type,
                    priority: issue.priority,
                    description: issue.description,
                    attempted_solutions: issue.attempted_solutions || [],
                    requesting_agent: context.agent_id,
                    timestamp: new Date().toISOString()
                })
            });
            // Update agent status to blocked
            await this.memory.updateAgentCoordination({
                session_id: context.session_id,
                agent_id: context.agent_id,
                agent_type: context.agent_type,
                status: 'blocked',
                error_state: issue.description
            });
            this.logger.warn(`Requested Queen intervention for ${issue.type}`);
        }
        catch (error) {
            this.logger.error('Failed to request Queen intervention', error);
            throw error;
        }
    }
    /**
     * Get session artifacts created by all agents
     */
    async getSessionArtifacts(session_id) {
        try {
            return await this.memory.getSessionArtifacts(session_id);
        }
        catch (error) {
            this.logger.error('Failed to get session artifacts', error);
            return [];
        }
    }
    /**
     * Get current session context
     */
    async getSessionContext(session_id) {
        try {
            return await this.memory.getSessionContext(session_id);
        }
        catch (error) {
            this.logger.error('Failed to get session context', error);
            return {};
        }
    }
}
exports.AgentContextProvider = AgentContextProvider;
//# sourceMappingURL=agent-context-provider.js.map