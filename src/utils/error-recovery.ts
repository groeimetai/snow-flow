/**
 * Snow-Flow Error Handling & Recovery System
 * Implements comprehensive error recovery patterns from MCP Architecture
 */

import { EventEmitter } from 'events';
import { Logger } from './logger';
import { MemorySystem } from '../memory/memory-system';

export interface ErrorContext {
  operation: string;
  sessionId?: string;
  agentId?: string;
  artifactId?: string;
  attemptNumber?: number;
  fallbackStrategies?: string[];
  metadata?: Record<string, any>;
}

export interface RecoveryStrategy {
  name: string;
  condition: (error: Error, context: ErrorContext) => boolean;
  execute: (error: Error, context: ErrorContext) => Promise<RecoveryResult>;
  priority: number;
}

export interface RecoveryResult {
  success: boolean;
  strategyUsed?: string;
  result?: any;
  error?: Error;
  nextStrategies?: string[];
}

export interface ErrorMetrics {
  totalErrors: number;
  recoveredErrors: number;
  failedRecoveries: number;
  errorsByType: Record<string, number>;
  recoveryStrategiesUsed: Record<string, number>;
  averageRecoveryTime: number;
}

export class ErrorRecovery extends EventEmitter {
  private logger: Logger;
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private errorHistory: ErrorRecord[] = [];
  private memory?: MemorySystem;
  private maxRetries = 3;
  private retryDelay = 1000;
  private exponentialBackoff = true;

  constructor(logger: Logger, memory?: MemorySystem) {
    super();
    this.logger = logger;
    this.memory = memory;
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Retry strategy
    this.registerStrategy({
      name: 'retry',
      condition: (error, context) => {
        return (context.attemptNumber || 0) < this.maxRetries &&
               !this.isUnrecoverable(error);
      },
      execute: async (error, context) => {
        const attempt = (context.attemptNumber || 0) + 1;
        const delay = this.calculateRetryDelay(attempt);
        
        this.logger.info(`Retrying operation ${context.operation} (attempt ${attempt}/${this.maxRetries})`);
        await this.delay(delay);
        
        return {
          success: false,
          strategyUsed: 'retry',
          nextStrategies: ['retry', 'fallback']
        };
      },
      priority: 100
    });

    // Permission escalation strategy
    this.registerStrategy({
      name: 'permission_escalation',
      condition: (error) => this.isPermissionError(error),
      execute: async (error, context) => {
        this.logger.info('Attempting permission escalation...');
        
        try {
          // Request elevated permissions through Queen agent
          await this.requestPermissionEscalation(context);
          
          return {
            success: true,
            strategyUsed: 'permission_escalation'
          };
        } catch (escalationError) {
          return {
            success: false,
            error: escalationError as Error,
            nextStrategies: ['manual_intervention']
          };
        }
      },
      priority: 90
    });

    // Scope fallback strategy
    this.registerStrategy({
      name: 'scope_fallback',
      condition: (error) => this.isScopeError(error),
      execute: async (error, context) => {
        this.logger.info('Attempting global scope fallback...');
        
        try {
          // Modify context to use global scope
          const globalContext = {
            ...context,
            metadata: {
              ...context.metadata,
              scope: 'global',
              fallbackReason: 'scope_error'
            }
          };
          
          return {
            success: true,
            strategyUsed: 'scope_fallback',
            result: globalContext
          };
        } catch (fallbackError) {
          return {
            success: false,
            error: fallbackError as Error
          };
        }
      },
      priority: 85
    });

    // Cache invalidation strategy
    this.registerStrategy({
      name: 'cache_invalidation',
      condition: (error) => this.isDataConsistencyError(error),
      execute: async (error, context) => {
        this.logger.info('Invalidating cache and refreshing data...');
        
        try {
          if (this.memory) {
            await this.memory.invalidateCache(context.sessionId || 'global');
          }
          
          return {
            success: true,
            strategyUsed: 'cache_invalidation',
            nextStrategies: ['retry']
          };
        } catch (cacheError) {
          return {
            success: false,
            error: cacheError as Error
          };
        }
      },
      priority: 80
    });

    // Partial success strategy
    this.registerStrategy({
      name: 'partial_success',
      condition: (error, context) => {
        return context.metadata?.allowPartial === true &&
               this.canPartiallySucceed(error);
      },
      execute: async (error, context) => {
        this.logger.info('Attempting partial success recovery...');
        
        const partialResult = await this.extractPartialSuccess(error, context);
        
        return {
          success: true,
          strategyUsed: 'partial_success',
          result: partialResult
        };
      },
      priority: 70
    });

    // Manual intervention strategy
    this.registerStrategy({
      name: 'manual_intervention',
      condition: () => true, // Last resort
      execute: async (error, context) => {
        this.logger.warn('Manual intervention required');
        
        // Generate manual steps
        const manualSteps = await this.generateManualSteps(error, context);
        
        // Store for later retrieval
        if (this.memory) {
          await this.memory.store(`manual_intervention_${context.sessionId}`, {
            error: error.message,
            context,
            steps: manualSteps,
            timestamp: new Date()
          });
        }
        
        return {
          success: false,
          strategyUsed: 'manual_intervention',
          result: { manualSteps },
          error: new Error('Manual intervention required. Check logs for instructions.')
        };
      },
      priority: 10
    });
  }

  /**
   * Register a custom recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.debug(`Registered recovery strategy: ${strategy.name}`);
  }

  /**
   * Handle an error with automatic recovery
   */
  async handleError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    this.logger.error(`Error in operation ${context.operation}:`, error);
    this.recordError(error, context);
    
    // Get applicable strategies sorted by priority
    const applicableStrategies = this.getApplicableStrategies(error, context);
    
    let lastResult: RecoveryResult = {
      success: false,
      error
    };
    
    // Try each strategy in order
    for (const strategy of applicableStrategies) {
      try {
        this.logger.info(`Attempting recovery strategy: ${strategy.name}`);
        lastResult = await strategy.execute(error, context);
        
        if (lastResult.success) {
          const duration = Date.now() - startTime;
          this.recordRecovery(strategy.name, duration);
          this.emit('recovery:success', {
            strategy: strategy.name,
            duration,
            context
          });
          return lastResult;
        }
        
        // If strategy suggests next strategies, filter to those
        if (lastResult.nextStrategies) {
          const nextStrategies = lastResult.nextStrategies
            .map(name => this.strategies.get(name))
            .filter(s => s && s.condition(error, context))
            .sort((a, b) => b!.priority - a!.priority);
          
          if (nextStrategies.length > 0) {
            // Continue with suggested strategies
            for (const nextStrategy of nextStrategies) {
              if (nextStrategy && !applicableStrategies.includes(nextStrategy)) {
                applicableStrategies.push(nextStrategy);
              }
            }
          }
        }
      } catch (strategyError) {
        this.logger.error(`Recovery strategy ${strategy.name} failed:`, strategyError);
      }
    }
    
    // All strategies failed
    const duration = Date.now() - startTime;
    this.recordFailedRecovery(error, context, duration);
    this.emit('recovery:failed', {
      error,
      context,
      duration,
      strategiesAttempted: applicableStrategies.map(s => s.name)
    });
    
    return lastResult;
  }

  /**
   * Handle critical errors that affect the entire system
   */
  async handleCriticalError(error: Error, context: ErrorContext): Promise<void> {
    this.logger.error('CRITICAL ERROR:', error);
    
    // Notify all active agents
    this.emit('critical:error', { error, context });
    
    // Attempt emergency recovery
    const emergencyStrategies = context.fallbackStrategies || [
      'emergency_shutdown',
      'data_preservation',
      'rollback_all'
    ];
    
    for (const strategyName of emergencyStrategies) {
      try {
        await this.executeEmergencyStrategy(strategyName, error, context);
      } catch (emergencyError) {
        this.logger.error(`Emergency strategy ${strategyName} failed:`, emergencyError);
      }
    }
  }

  /**
   * Attempt to recover a failed swarm session
   */
  async attemptSwarmRecovery(sessionId: string, error: Error): Promise<RecoveryResult> {
    const context: ErrorContext = {
      operation: 'swarm_execution',
      sessionId,
      fallbackStrategies: [
        'resume_from_checkpoint',
        'restart_failed_agents',
        'rollback_to_stable'
      ]
    };
    
    // Check if we have a checkpoint
    if (this.memory) {
      const checkpoint = await this.memory.get(`checkpoint_${sessionId}`);
      if (checkpoint) {
        try {
          const result = await this.resumeFromCheckpoint(sessionId, checkpoint);
          return {
            success: true,
            strategyUsed: 'resume_from_checkpoint',
            result
          };
        } catch (resumeError) {
          this.logger.error('Failed to resume from checkpoint:', resumeError);
        }
      }
    }
    
    // Try standard error recovery
    return this.handleError(error, context);
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    const metrics: ErrorMetrics = {
      totalErrors: this.errorHistory.length,
      recoveredErrors: 0,
      failedRecoveries: 0,
      errorsByType: {},
      recoveryStrategiesUsed: {},
      averageRecoveryTime: 0
    };
    
    let totalRecoveryTime = 0;
    let recoveryCount = 0;
    
    for (const record of this.errorHistory) {
      // Count by type
      const errorType = record.error.name || 'Unknown';
      metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;
      
      // Count recoveries
      if (record.recovered) {
        metrics.recoveredErrors++;
        if (record.recoveryStrategy) {
          metrics.recoveryStrategiesUsed[record.recoveryStrategy] = 
            (metrics.recoveryStrategiesUsed[record.recoveryStrategy] || 0) + 1;
        }
        if (record.recoveryDuration) {
          totalRecoveryTime += record.recoveryDuration;
          recoveryCount++;
        }
      } else {
        metrics.failedRecoveries++;
      }
    }
    
    if (recoveryCount > 0) {
      metrics.averageRecoveryTime = totalRecoveryTime / recoveryCount;
    }
    
    return metrics;
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Private helper methods
   */
  private getApplicableStrategies(error: Error, context: ErrorContext): RecoveryStrategy[] {
    const strategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.condition(error, context))
      .sort((a, b) => b.priority - a.priority);
    
    // If custom fallback strategies specified, prioritize those
    if (context.fallbackStrategies) {
      const customStrategies = context.fallbackStrategies
        .map(name => this.strategies.get(name))
        .filter(s => s && s.condition(error, context)) as RecoveryStrategy[];
      
      return [...customStrategies, ...strategies];
    }
    
    return strategies;
  }

  private isUnrecoverable(error: Error): boolean {
    const unrecoverableErrors = [
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'CERT_HAS_EXPIRED'
    ];
    
    return unrecoverableErrors.some(code => 
      error.message.includes(code) || (error as any).code === code
    );
  }

  private isPermissionError(error: Error): boolean {
    const permissionIndicators = [
      'permission denied',
      'access denied',
      'unauthorized',
      '401',
      '403',
      'insufficient privileges'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return permissionIndicators.some(indicator => 
      errorMessage.includes(indicator)
    );
  }

  private isScopeError(error: Error): boolean {
    const scopeIndicators = [
      'scope not found',
      'application scope',
      'wrong scope',
      'scope mismatch'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return scopeIndicators.some(indicator => 
      errorMessage.includes(indicator)
    );
  }

  private isDataConsistencyError(error: Error): boolean {
    const consistencyIndicators = [
      'data inconsistency',
      'stale data',
      'cache invalid',
      'version mismatch'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return consistencyIndicators.some(indicator => 
      errorMessage.includes(indicator)
    );
  }

  private canPartiallySucceed(error: Error): boolean {
    // Determine if the operation can partially succeed
    return error.message.includes('partial') || 
           error.message.includes('some operations failed');
  }

  private calculateRetryDelay(attemptNumber: number): number {
    if (this.exponentialBackoff) {
      return Math.min(
        this.retryDelay * Math.pow(2, attemptNumber - 1),
        30000 // Max 30 seconds
      );
    }
    return this.retryDelay;
  }

  private async requestPermissionEscalation(context: ErrorContext): Promise<void> {
    // Emit event for Queen agent to handle
    this.emit('permission:escalation:requested', context);
    
    // Wait for escalation (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Permission escalation timeout'));
      }, 30000);
      
      this.once('permission:escalation:granted', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.once('permission:escalation:denied', () => {
        clearTimeout(timeout);
        reject(new Error('Permission escalation denied'));
      });
    });
  }

  private async extractPartialSuccess(error: Error, context: ErrorContext): Promise<any> {
    // Extract any partial results from the error context
    if ((error as any).partialResult) {
      return (error as any).partialResult;
    }
    
    // Check memory for partial results
    if (this.memory && context.sessionId) {
      const partialData = await this.memory.get(`partial_${context.sessionId}`);
      if (partialData) {
        return partialData;
      }
    }
    
    return null;
  }

  private async generateManualSteps(error: Error, context: ErrorContext): Promise<string[]> {
    const steps: string[] = [];
    
    if (this.isPermissionError(error)) {
      steps.push('1. Log into ServiceNow as an administrator');
      steps.push('2. Navigate to System Security > Users and Groups > Users');
      steps.push('3. Find the integration user and click on it');
      steps.push('4. Go to the Roles tab and add required roles');
      steps.push('5. Save the changes and retry the operation');
    } else if (this.isScopeError(error)) {
      steps.push('1. Log into ServiceNow as an administrator');
      steps.push('2. Navigate to System Applications > Applications');
      steps.push('3. Switch to the Global scope');
      steps.push('4. Retry the operation in Global scope');
      steps.push('5. If successful, move the artifact to the desired scope');
    } else {
      steps.push('1. Check ServiceNow instance availability');
      steps.push('2. Verify network connectivity');
      steps.push('3. Check authentication credentials');
      steps.push('4. Review error logs for specific issues');
      steps.push('5. Contact support if issue persists');
    }
    
    return steps;
  }

  private async executeEmergencyStrategy(
    strategyName: string,
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    switch (strategyName) {
      case 'emergency_shutdown':
        this.emit('system:emergency:shutdown', { error, context });
        break;
        
      case 'data_preservation':
        if (this.memory) {
          await this.memory.createEmergencyBackup();
        }
        break;
        
      case 'rollback_all':
        this.emit('system:rollback:all', { error, context });
        break;
        
      default:
        this.logger.warn(`Unknown emergency strategy: ${strategyName}`);
    }
  }

  private async resumeFromCheckpoint(sessionId: string, checkpoint: any): Promise<any> {
    this.logger.info(`Resuming session ${sessionId} from checkpoint`);
    
    // Emit event for system to resume
    this.emit('session:resume', {
      sessionId,
      checkpoint
    });
    
    return checkpoint;
  }

  private recordError(error: Error, context: ErrorContext): void {
    this.errorHistory.push({
      error,
      context,
      timestamp: new Date(),
      recovered: false
    });
    
    // Limit history size
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-500);
    }
  }

  private recordRecovery(strategyName: string, duration: number): void {
    const lastError = this.errorHistory[this.errorHistory.length - 1];
    if (lastError) {
      lastError.recovered = true;
      lastError.recoveryStrategy = strategyName;
      lastError.recoveryDuration = duration;
    }
  }

  private recordFailedRecovery(error: Error, context: ErrorContext, duration: number): void {
    const lastError = this.errorHistory[this.errorHistory.length - 1];
    if (lastError) {
      lastError.recovered = false;
      lastError.recoveryDuration = duration;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Type definitions
interface ErrorRecord {
  error: Error;
  context: ErrorContext;
  timestamp: Date;
  recovered: boolean;
  recoveryStrategy?: string;
  recoveryDuration?: number;
}

// Export pre-configured strategies
export const FALLBACK_STRATEGIES = {
  widget_deployment: [
    'retry',
    'scope_fallback',
    'permission_escalation',
    'partial_success',
    'manual_intervention'
  ],
  flow_creation: [
    'retry',
    'cache_invalidation',
    'scope_fallback',
    'manual_intervention'
  ],
  script_execution: [
    'retry',
    'permission_escalation',
    'partial_success',
    'manual_intervention'
  ],
  integration_failure: [
    'retry',
    'cache_invalidation',
    'partial_success',
    'manual_intervention'
  ]
};