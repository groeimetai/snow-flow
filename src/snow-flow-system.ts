/**
 * Snow-Flow Main Integration Layer
 * Coordinates all subsystems: Agents, Memory, MCPs, and ServiceNow
 */

import { EventEmitter } from 'events';
import { SnowFlowConfig, ISnowFlowConfig } from './config/snow-flow-config';
// import { QueenOrchestrator } from './sdk/queen-orchestrator.js'; // REMOVED - Queen architecture deprecated
import { MemorySystem, BasicMemorySystem } from './memory/memory-system';
import { PerformanceTracker } from './monitoring/performance-tracker';
import { SystemHealth } from './health/system-health';
import { ErrorRecovery } from './utils/error-recovery';
import { Logger } from './utils/logger';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

export interface SwarmSession {
  id: string;
  objective: string;
  startedAt: Date;
  status: 'initializing' | 'active' | 'completing' | 'completed' | 'failed';
  queenAgentId: string;
  activeAgents: Map<string, AgentInfo>;
  completedTasks: number;
  totalTasks: number;
  errors: Error[];
}

export interface AgentInfo {
  id: string;
  type: string;
  status: 'spawned' | 'active' | 'blocked' | 'completed' | 'failed';
  assignedTasks: string[];
  progress: number;
  lastActivity: Date;
}

export class SnowFlowSystem extends EventEmitter {
  private config: SnowFlowConfig;
  // private queen?: QueenOrchestrator; // REMOVED - Queen architecture deprecated
  private memory?: MemorySystem;
  private performanceTracker?: PerformanceTracker;
  private systemHealth?: SystemHealth;
  private errorRecovery: ErrorRecovery;
  private logger: Logger;
  private sessions: Map<string, SwarmSession> = new Map();
  private initialized = false;

  constructor(config?: Partial<ISnowFlowConfig>) {
    super();
    this.config = new SnowFlowConfig(config);
    this.logger = new Logger('SnowFlowSystem');
    this.errorRecovery = new ErrorRecovery(this.logger);
  }

  /**
   * Initialize the entire Snow-Flow system
   */
  async initialize(): Promise<void> {
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
      
    } catch (error) {
      this.logger.error('System initialization failed:', error);
      await this.errorRecovery.handleCriticalError(error as Error, {
        operation: 'system_initialization',
        fallbackStrategies: ['retry_initialization', 'partial_initialization']
      });
      throw error;
    }
  }

  /**
   * Initialize Memory System with SQLite
   */
  private async initializeMemory(): Promise<void> {
    this.logger.info('Initializing Memory System...');
    
    const dbPath = path.join(
      os.homedir(),
      '.snow-flow',
      'memory',
      'snow-flow.db'
    );
    
    this.memory = new BasicMemorySystem();
    
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
  private async initializePerformanceTracking(): Promise<void> {
    this.logger.info('Initializing Performance Tracking...');
    
    if (!this.memory) {
      throw new Error('Memory must be initialized before Performance Tracking');
    }
    
    this.performanceTracker = new PerformanceTracker({
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
  private async initializeHealthMonitoring(): Promise<void> {
    this.logger.info('Initializing System Health Monitoring...');

    if (!this.memory) {
      throw new Error('Memory must be initialized before Health Monitoring');
    }

    this.systemHealth = new SystemHealth({
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
  async executeSwarm(objective: string, options: SwarmOptions = {}): Promise<SwarmResult> {
    if (!this.initialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }
    
    const sessionId = this.generateSessionId();
    const session: SwarmSession = {
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
      
    } catch (error) {
      session.status = 'failed';
      session.errors.push(error as Error);
      
      await this.performanceTracker?.endOperation('swarm_execution', {
        success: false,
        error: (error as Error).message
      });
      
      // Attempt recovery
      const recovery = await this.errorRecovery.attemptSwarmRecovery(sessionId, error as Error);
      
      if (recovery.success) {
        return recovery.result as SwarmResult;
      }
      
      throw error;
    }
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<SystemStatus> {
    if (!this.initialized) {
      return {
        initialized: false,
        status: 'not_initialized',
        components: {}
      };
    }
    
    const healthStatus = await this.systemHealth!.getFullStatus();
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
  async shutdown(): Promise<void> {
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
      
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): SwarmSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(filter?: { status?: string }): SwarmSession[] {
    const sessions = Array.from(this.sessions.values());
    
    if (filter?.status) {
      return sessions.filter(s => s.status === filter.status);
    }
    
    return sessions;
  }

  /**
   * Get memory system instance
   */
  getMemory(): MemorySystem | undefined {
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
  private generateSessionId(): string {
    return `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAgentInfo(session: SwarmSession, update: any): void {
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

  private async gracefullyCompleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
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

  private async calculateSuccessRate(): Promise<number> {
    const sessions = Array.from(this.sessions.values());
    const completed = sessions.filter(s => s.status === 'completed').length;
    const total = sessions.filter(s => ['completed', 'failed'].includes(s.status)).length;
    
    return total > 0 ? (completed / total) * 100 : 0;
  }

  private async calculateAverageExecutionTime(): Promise<number> {
    const metrics = await this.performanceTracker?.getAggregateMetrics('swarm_execution');
    return metrics?.averageDuration || 0;
  }
}

// Type definitions
export interface SwarmOptions {
  strategy?: 'research' | 'development' | '_analysis' | 'testing' | 'optimization' | 'maintenance';
  mode?: 'centralized' | 'distributed' | 'hierarchical' | 'mesh' | 'hybrid';
  maxAgents?: number;
  parallel?: boolean;
  monitor?: boolean;
  autoPermissions?: boolean;
  smartDiscovery?: boolean;
  liveTesting?: boolean;
  autoDeploy?: boolean;
  autoRollback?: boolean;
  sharedMemory?: boolean;
  progressMonitoring?: boolean;
}

export interface SwarmResult {
  sessionId: string;
  success: boolean;
  artifacts: any[];
  summary: string;
  metrics: any;
}

export interface SystemStatus {
  initialized: boolean;
  status: string;
  components: Record<string, any>;
  activeSessions?: number;
  metrics?: any;
}

// Export singleton instance
export const snowFlowSystem = new SnowFlowSystem();