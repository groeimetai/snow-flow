"use strict";
/**
 * Snow-Flow Main Integration Layer
 * Coordinates all subsystems: Agents, Memory, MCPs, and ServiceNow
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.snowFlowSystem = exports.SnowFlowSystem = void 0;
const events_1 = require("events");
const snow_flow_config_1 = require("./config/snow-flow-config");
// import { QueenOrchestrator } from './sdk/queen-orchestrator.js'; // REMOVED - Queen architecture deprecated
const memory_system_1 = require("./memory/memory-system");
const performance_tracker_1 = require("./monitoring/performance-tracker");
const system_health_1 = require("./health/system-health");
const error_recovery_1 = require("./utils/error-recovery");
const logger_1 = require("./utils/logger");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class SnowFlowSystem extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.sessions = new Map();
        this.initialized = false;
        this.config = new snow_flow_config_1.SnowFlowConfig(config);
        this.logger = new logger_1.Logger('SnowFlowSystem');
        this.errorRecovery = new error_recovery_1.ErrorRecovery(this.logger);
    }
    /**
     * Initialize the entire Snow-Flow system
     */
    async initialize() {
        if (this.initialized) {
            this.logger.info('System already initialized');
            return;
        }
        try {
            this.logger.info('Initializing Snow-Flow System...');
            // 1. Initialize Memory System
            await this.initializeMemory();
            // 2. Initialize Queen Orchestrator (SDK-based) - DISABLED (Queen architecture deprecated)
            // await this.initializeQueen();
            // 3. Initialize Performance Tracking
            await this.initializePerformanceTracking();
            // 4. Initialize System Health Monitoring
            await this.initializeHealthMonitoring();
            this.initialized = true;
            this.emit('system:initialized');
            this.logger.info('Snow-Flow System initialized successfully');
        }
        catch (error) {
            this.logger.error('System initialization failed:', error);
            await this.errorRecovery.handleCriticalError(error, {
                operation: 'system_initialization',
                fallbackStrategies: ['retry_initialization', 'partial_initialization']
            });
            throw error;
        }
    }
    /**
     * Initialize Memory System with SQLite
     */
    async initializeMemory() {
        this.logger.info('Initializing Memory System...');
        const dbPath = path_1.default.join(os_1.default.homedir(), '.snow-flow', 'memory', 'snow-flow.db');
        this.memory = new memory_system_1.BasicMemorySystem();
        await this.memory.initialize();
        this.emit('memory:initialized');
    }
    /**
     * Initialize Queen Orchestrator (SDK-based) - DISABLED
     * NOTE: Queen architecture has been deprecated
     */
    // private async initializeQueen(): Promise<void> {
    //   this.logger.info('Initializing Queen Orchestrator (SDK-based)...');
    //
    //   if (!this.memory) {
    //     throw new Error('Memory must be initialized before Queen Orchestrator');
    //   }
    //
    //   // Create new SDK-based Queen Orchestrator
    //   this.queen = new QueenOrchestrator(this.memory);
    //
    //   // Setup event forwarding from Queen to System
    //   this.queen.on('orchestration:started', (objective) => {
    //     this.emit('queen:orchestration-started', objective);
    //   });
    //
    //   this.queen.on('orchestration:completed', (result) => {
    //     this.emit('queen:orchestration-completed', result);
    //   });
    //
    //   this.queen.on('orchestration:failed', ({ objective, error }) => {
    //     this.emit('queen:orchestration-failed', { objective, error });
    //   });
    //
    //   this.logger.info('✅ Queen Orchestrator initialized with Claude Agent SDK v0.1.1');
    //   this.emit('queen:initialized');
    // }
    /**
     * Initialize Performance Tracking
     */
    async initializePerformanceTracking() {
        this.logger.info('Initializing Performance Tracking...');
        if (!this.memory) {
            throw new Error('Memory must be initialized before Performance Tracking');
        }
        this.performanceTracker = new performance_tracker_1.PerformanceTracker({
            memory: this.memory,
            config: { sampleRate: 100, metricsRetention: 86400000, aggregationInterval: 60000, ...(this.config.monitoring.performance || {}) }
        });
        await this.performanceTracker.initialize();
        // Set up performance monitoring
        this.performanceTracker.on('metric:recorded', (metric) => {
            this.emit('performance:metric', metric);
        });
        this.emit('performance:initialized');
    }
    /**
     * Initialize System Health Monitoring
     */
    async initializeHealthMonitoring() {
        this.logger.info('Initializing System Health Monitoring...');
        if (!this.memory) {
            throw new Error('Memory must be initialized before Health Monitoring');
        }
        this.systemHealth = new system_health_1.SystemHealth({
            memory: this.memory,
            mcpManager: undefined, // SDK manages MCP servers now
            config: {
                checks: { memory: true, mcp: false, servicenow: true, queen: true }, // Disable MCP check
                thresholds: { memoryUsage: 85, responseTime: 5000, queueSize: 100, cpuUsage: 80, errorRate: 5 }
            }
        });
        await this.systemHealth.initialize();
        // Set up health monitoring
        this.systemHealth.on('health:check', (status) => {
            this.emit('health:status', status);
        });
        // Start periodic health checks
        await this.systemHealth.startMonitoring();
        this.emit('health:initialized');
    }
    /**
     * Execute a swarm objective
     */
    async executeSwarm(objective, options = {}) {
        if (!this.initialized) {
            throw new Error('System not initialized. Call initialize() first.');
        }
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            objective,
            startedAt: new Date(),
            status: 'initializing',
            queenAgentId: '',
            activeAgents: new Map(),
            completedTasks: 0,
            totalTasks: 0,
            errors: []
        };
        this.sessions.set(sessionId, session);
        try {
            // Track swarm execution
            await this.performanceTracker?.startOperation('swarm_execution', {
                sessionId,
                objective
            });
            // Execute objective using new Queen Orchestrator (SDK-based) - DISABLED
            this.logger.info(`🎯 Starting orchestration for: ${objective}`);
            // const queenResult = await this.queen!.orchestrate({
            //   id: sessionId,
            //   description: objective,
            //   priority: 'high'
            // });
            // TEMPORARY: Return mock result until swarm orchestration is properly integrated
            const queenResult = {
                success: false,
                objective: objective,
                agentsUsed: [],
                agentsSpawned: 0,
                tasks: [],
                artifacts: [],
                artifactsCreated: 0,
                todos: [],
                duration: 0,
                error: new Error('Queen orchestration is deprecated. Use swarm command instead.')
            };
            session.queenAgentId = sessionId;
            session.totalTasks = queenResult.todos.length;
            session.status = 'active';
            session.completedTasks = queenResult.todos.filter(t => t.status === 'completed').length;
            this.emit('swarm:progress', {
                sessionId,
                progress: {
                    completed: session.completedTasks,
                    total: session.totalTasks,
                    status: 'completed',
                    sdkBased: true,
                    agentsSpawned: queenResult.agentsSpawned
                }
            });
            session.status = 'completed';
            await this.performanceTracker?.endOperation('swarm_execution', {
                success: queenResult.success
            });
            return {
                sessionId,
                success: queenResult.success,
                artifacts: queenResult.artifacts,
                summary: `Orchestration completed: ${queenResult.agentsSpawned} agents spawned, ${queenResult.artifactsCreated} artifacts created`,
                metrics: await this.performanceTracker?.getSessionMetrics(sessionId) || {}
            };
        }
        catch (error) {
            session.status = 'failed';
            session.errors.push(error);
            await this.performanceTracker?.endOperation('swarm_execution', {
                success: false,
                error: error.message
            });
            // Attempt recovery
            const recovery = await this.errorRecovery.attemptSwarmRecovery(sessionId, error);
            if (recovery.success) {
                return recovery.result;
            }
            throw error;
        }
    }
    /**
     * Get system status
     */
    async getStatus() {
        if (!this.initialized) {
            return {
                initialized: false,
                status: 'not_initialized',
                components: {}
            };
        }
        const healthStatus = await this.systemHealth.getFullStatus();
        const activeSessions = Array.from(this.sessions.values())
            .filter(s => s.status === 'active');
        return {
            initialized: true,
            status: healthStatus.healthy ? 'healthy' : 'degraded',
            components: {
                memory: healthStatus.components.memory,
                mcp: healthStatus.components.mcp,
                queen: healthStatus.components.queen,
                performance: healthStatus.components.performance
            },
            activeSessions: activeSessions.length,
            metrics: {
                totalSessions: this.sessions.size,
                successRate: await this.calculateSuccessRate(),
                averageExecutionTime: await this.calculateAverageExecutionTime()
            }
        };
    }
    /**
     * Shutdown the system gracefully
     */
    async shutdown() {
        this.logger.info('Shutting down Snow-Flow System...');
        try {
            // Complete active sessions
            for (const session of this.sessions.values()) {
                if (session.status === 'active') {
                    await this.gracefullyCompleteSession(session.id);
                }
            }
            // Shutdown components in reverse order
            await this.systemHealth?.stopMonitoring();
            await this.performanceTracker?.shutdown();
            // await this.queen?.shutdown(); // SDK-based shutdown - DISABLED (Queen architecture deprecated)
            await this.memory?.close();
            this.initialized = false;
            this.emit('system:shutdown');
            this.logger.info('Snow-Flow System shutdown complete');
        }
        catch (error) {
            this.logger.error('Error during shutdown:', error);
            throw error;
        }
    }
    /**
     * Get session information
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * List all sessions
     */
    listSessions(filter) {
        const sessions = Array.from(this.sessions.values());
        if (filter?.status) {
            return sessions.filter(s => s.status === filter.status);
        }
        return sessions;
    }
    /**
     * Get memory system instance
     */
    getMemory() {
        return this.memory;
    }
    /**
     * Get Queen Orchestrator instance - DISABLED (Queen architecture deprecated)
     */
    // getQueenOrchestrator(): QueenOrchestrator | undefined {
    //   return this.queen;
    // }
    /**
     * Private helper methods
     */
    generateSessionId() {
        return `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    updateAgentInfo(session, update) {
        const agent = session.activeAgents.get(update.agentId) || {
            id: update.agentId,
            type: update.agentType,
            status: 'spawned',
            assignedTasks: [],
            progress: 0,
            lastActivity: new Date()
        };
        Object.assign(agent, update);
        session.activeAgents.set(update.agentId, agent);
    }
    async gracefullyCompleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.logger.info(`Gracefully completing session ${sessionId}`);
        // Notify all active agents to wrap up
        for (const agent of session.activeAgents.values()) {
            if (agent.status === 'active') {
                // Use available shutdown method
                // await this.queen?.shutdown(); // No per-agent shutdown available - DISABLED (Queen deprecated)
            }
        }
        // Wait for agents to complete (max 30 seconds)
        const timeout = setTimeout(() => {
            session.status = 'completed';
        }, 30000);
        while (session.status === 'active') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const activeAgents = Array.from(session.activeAgents.values())
                .filter(a => a.status === 'active');
            if (activeAgents.length === 0) {
                session.status = 'completed';
                clearTimeout(timeout);
                break;
            }
        }
    }
    async calculateSuccessRate() {
        const sessions = Array.from(this.sessions.values());
        const completed = sessions.filter(s => s.status === 'completed').length;
        const total = sessions.filter(s => ['completed', 'failed'].includes(s.status)).length;
        return total > 0 ? (completed / total) * 100 : 0;
    }
    async calculateAverageExecutionTime() {
        const metrics = await this.performanceTracker?.getAggregateMetrics('swarm_execution');
        return metrics?.averageDuration || 0;
    }
}
exports.SnowFlowSystem = SnowFlowSystem;
// Export singleton instance
exports.snowFlowSystem = new SnowFlowSystem();
//# sourceMappingURL=snow-flow-system.js.map