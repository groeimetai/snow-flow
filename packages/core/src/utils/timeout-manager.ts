/**
 * Timeout Manager for Snow-Flow
 * Provides intelligent timeout configuration and retry logic
 */

import { Logger } from './logger.js';

const logger = new Logger('TimeoutManager');

/**
 * Operation types with their specific timeout requirements
 */
export enum OperationType {
  // Quick operations (30s)
  SIMPLE_QUERY = 'simple_query',
  SINGLE_RECORD = 'single_record',
  HEALTH_CHECK = 'health_check',
  
  // Standard operations (2 min)
  TABLE_QUERY = 'table_query',
  CREATE_RECORD = 'create_record',
  UPDATE_RECORD = 'update_record',
  DELETE_RECORD = 'delete_record',
  
  // Complex operations (5 min)
  BATCH_OPERATION = 'batch_operation',
  BULK_QUERY = 'bulk_query',
  DEPLOYMENT = 'deployment',
  WORKFLOW_EXECUTION = 'workflow_execution',
  
  // ML operations (10 min)
  ML_TRAINING = 'ml_training',
  ML_BATCH_FETCH = 'ml_batch_fetch',
  ML_PREDICTION = 'ml_prediction',
  
  // Long running operations (15 min)
  LARGE_EXPORT = 'large_export',
  MIGRATION = 'migration',
  FULL_SYNC = 'full_sync'
}

/**
 * Timeout configuration with intelligent defaults
 */
export interface TimeoutConfig {
  baseTimeout: number;
  maxTimeout: number;
  retryCount: number;
  backoffMultiplier: number;
  jitterRange: number;
}

/**
 * Get timeout configuration for operation type
 */
export function getTimeoutConfig(operationType: OperationType): TimeoutConfig {
  // Allow environment variable overrides
  const envTimeout = process.env.SNOW_TIMEOUT_OVERRIDE ? 
    parseInt(process.env.SNOW_TIMEOUT_OVERRIDE) : null;
  
  // Default timeout configurations per operation type
  const configs: Record<OperationType, TimeoutConfig> = {
    // Quick operations - 30 seconds
    [OperationType.SIMPLE_QUERY]: {
      baseTimeout: envTimeout || 30000,
      maxTimeout: 60000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 1000
    },
    [OperationType.SINGLE_RECORD]: {
      baseTimeout: envTimeout || 30000,
      maxTimeout: 60000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 1000
    },
    [OperationType.HEALTH_CHECK]: {
      baseTimeout: envTimeout || 30000,
      maxTimeout: 45000,
      retryCount: 1,
      backoffMultiplier: 1.2,
      jitterRange: 500
    },
    
    // Standard operations - 2 minutes
    [OperationType.TABLE_QUERY]: {
      baseTimeout: envTimeout || 120000,
      maxTimeout: 300000,
      retryCount: 3,
      backoffMultiplier: 2,
      jitterRange: 2000
    },
    [OperationType.CREATE_RECORD]: {
      baseTimeout: envTimeout || 120000,
      maxTimeout: 240000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 1500
    },
    [OperationType.UPDATE_RECORD]: {
      baseTimeout: envTimeout || 120000,
      maxTimeout: 240000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 1500
    },
    [OperationType.DELETE_RECORD]: {
      baseTimeout: envTimeout || 120000,
      maxTimeout: 180000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 1000
    },
    
    // Complex operations - 5 minutes
    [OperationType.BATCH_OPERATION]: {
      baseTimeout: envTimeout || 300000,
      maxTimeout: 600000,
      retryCount: 3,
      backoffMultiplier: 2,
      jitterRange: 5000
    },
    [OperationType.BULK_QUERY]: {
      baseTimeout: envTimeout || 300000,
      maxTimeout: 600000,
      retryCount: 3,
      backoffMultiplier: 2,
      jitterRange: 5000
    },
    [OperationType.DEPLOYMENT]: {
      baseTimeout: envTimeout || 300000,
      maxTimeout: 600000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 3000
    },
    [OperationType.WORKFLOW_EXECUTION]: {
      baseTimeout: envTimeout || 300000,
      maxTimeout: 600000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 3000
    },
    
    // ML operations - 10 minutes
    [OperationType.ML_TRAINING]: {
      baseTimeout: envTimeout || 600000,
      maxTimeout: 900000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 10000
    },
    [OperationType.ML_BATCH_FETCH]: {
      baseTimeout: envTimeout || 600000,
      maxTimeout: 900000,
      retryCount: 3,
      backoffMultiplier: 2,
      jitterRange: 10000
    },
    [OperationType.ML_PREDICTION]: {
      baseTimeout: envTimeout || 300000,
      maxTimeout: 600000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 5000
    },
    
    // Long running operations - 15 minutes
    [OperationType.LARGE_EXPORT]: {
      baseTimeout: envTimeout || 900000,
      maxTimeout: 1800000,
      retryCount: 1,
      backoffMultiplier: 1.2,
      jitterRange: 15000
    },
    [OperationType.MIGRATION]: {
      baseTimeout: envTimeout || 900000,
      maxTimeout: 1800000,
      retryCount: 1,
      backoffMultiplier: 1.2,
      jitterRange: 15000
    },
    [OperationType.FULL_SYNC]: {
      baseTimeout: envTimeout || 900000,
      maxTimeout: 1800000,
      retryCount: 2,
      backoffMultiplier: 1.5,
      jitterRange: 15000
    }
  };
  
  const config = configs[operationType];
  
  // Log timeout configuration
  logger.debug(`Timeout config for ${operationType}:`, {
    baseTimeout: `${config.baseTimeout / 1000}s`,
    maxTimeout: `${config.maxTimeout / 1000}s`,
    retries: config.retryCount
  });
  
  return config;
}

/**
 * Calculate timeout with exponential backoff
 */
export function calculateTimeout(
  config: TimeoutConfig,
  attemptNumber: number
): number {
  // Base calculation with exponential backoff
  let timeout = config.baseTimeout * Math.pow(config.backoffMultiplier, attemptNumber);
  
  // Apply max timeout cap
  timeout = Math.min(timeout, config.maxTimeout);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * config.jitterRange - (config.jitterRange / 2);
  timeout += jitter;
  
  // Ensure minimum timeout
  timeout = Math.max(timeout, 5000); // At least 5 seconds
  
  logger.debug(`Calculated timeout for attempt ${attemptNumber + 1}: ${timeout / 1000}s`);
  
  return Math.floor(timeout);
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationType: OperationType,
  operationName?: string
): Promise<T> {
  const config = getTimeoutConfig(operationType);
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.retryCount; attempt++) {
    try {
      logger.info(`${operationName || operationType}: Attempt ${attempt + 1}/${config.retryCount + 1}`);
      
      // Create timeout promise
      const timeout = calculateTimeout(config, attempt);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeout / 1000} seconds`));
        }, timeout);
      });
      
      // Race operation against timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      
      logger.info(`${operationName || operationType}: Success on attempt ${attempt + 1}`);
      return result;
      
    } catch (error: any) {
      lastError = error;
      logger.warn(`${operationName || operationType}: Attempt ${attempt + 1} failed:`, error.message);
      
      // Check if we should retry
      if (attempt < config.retryCount) {
        // Check if error is retryable
        if (isRetryableError(error)) {
          const backoffDelay = calculateBackoffDelay(config, attempt);
          logger.info(`Retrying in ${backoffDelay / 1000} seconds...`);
          await delay(backoffDelay);
        } else {
          logger.error('Non-retryable error encountered, stopping retries');
          throw error;
        }
      }
    }
  }
  
  // All retries exhausted
  logger.error(`${operationName || operationType}: All retries exhausted`);
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND') {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.message?.toLowerCase().includes('timeout')) {
    return true;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 502, 503, 504];
  if (error.response?.status && retryableStatusCodes.includes(error.response.status)) {
    return true;
  }
  
  // ServiceNow specific retryable errors
  if (error.message?.includes('rate limit') ||
      error.message?.includes('too many requests') ||
      error.message?.includes('service unavailable')) {
    return true;
  }
  
  // Non-retryable errors
  if (error.response?.status >= 400 && error.response?.status < 500) {
    // Client errors (except those listed above) are not retryable
    return false;
  }
  
  // Default to retryable for unknown errors
  return true;
}

/**
 * Calculate backoff delay between retries
 */
function calculateBackoffDelay(config: TimeoutConfig, attemptNumber: number): number {
  const baseDelay = 2000; // 2 seconds base
  const delay = baseDelay * Math.pow(config.backoffMultiplier, attemptNumber);
  const jitter = Math.random() * config.jitterRange;
  return Math.min(delay + jitter, 30000); // Max 30 seconds between retries
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect operation type from context
 */
export function detectOperationType(context: {
  tool?: string;
  table?: string;
  action?: string;
  limit?: number;
}): OperationType {
  const { tool, table, action, limit } = context;
  
  // ML operations
  if (tool?.includes('ml_') || action?.includes('train') || action?.includes('predict')) {
    if (action?.includes('train')) return OperationType.ML_TRAINING;
    if (action?.includes('batch')) return OperationType.ML_BATCH_FETCH;
    return OperationType.ML_PREDICTION;
  }
  
  // Deployment operations
  if (tool?.includes('deploy') || action?.includes('deploy')) {
    return OperationType.DEPLOYMENT;
  }
  
  // Workflow operations
  if (tool?.includes('workflow') || table === 'wf_workflow') {
    return OperationType.WORKFLOW_EXECUTION;
  }
  
  // Batch/bulk operations
  if (tool?.includes('batch') || (limit && limit > 100)) {
    return OperationType.BATCH_OPERATION;
  }
  
  // Query operations
  if (tool?.includes('query') || action === 'query') {
    if (limit && limit > 500) return OperationType.BULK_QUERY;
    if (limit && limit > 50) return OperationType.TABLE_QUERY;
    return OperationType.SIMPLE_QUERY;
  }
  
  // CRUD operations
  if (action === 'create' || tool?.includes('create')) {
    return OperationType.CREATE_RECORD;
  }
  if (action === 'update' || tool?.includes('update')) {
    return OperationType.UPDATE_RECORD;
  }
  if (action === 'delete' || tool?.includes('delete')) {
    return OperationType.DELETE_RECORD;
  }
  
  // Default to standard query
  return OperationType.TABLE_QUERY;
}

/**
 * Get human-readable timeout description
 */
export function getTimeoutDescription(operationType: OperationType): string {
  const config = getTimeoutConfig(operationType);
  const baseMinutes = Math.ceil(config.baseTimeout / 60000);
  const maxMinutes = Math.ceil(config.maxTimeout / 60000);
  
  return `Base timeout: ${baseMinutes} min, Max: ${maxMinutes} min, Retries: ${config.retryCount}`;
}