/**
 * Centralized MCP Configuration Manager
 * Handles dynamic configuration loading for all MCP servers
 */

import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { Logger } from './logger.js';

// Load environment variables
config();

export interface MCPConfig {
  servicenow: {
    instanceUrl?: string;
    clientId?: string;
    clientSecret?: string;
    oauthRedirectUri?: string;
    maxRetries?: number;
    timeout?: number;
  };
  neo4j?: {
    uri?: string;
    username?: string;
    password?: string;
    database?: string;
  };
  memory: {
    provider: 'file' | 'neo4j' | 'redis';
    path?: string;
    connectionString?: string;
    maxSize?: number;
    ttl?: number;
  };
  performance: {
    connectionPoolSize?: number;
    requestTimeout?: number;
    retryAttempts?: number;
    cacheEnabled?: boolean;
    cacheTtl?: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableFileLogging?: boolean;
    logPath?: string;
  };
}

export class MCPConfigManager {
  private static instance: MCPConfigManager;
  private config: MCPConfig;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger('MCPConfigManager');
    this.config = this.loadConfiguration();
  }

  public static getInstance(): MCPConfigManager {
    if (!MCPConfigManager.instance) {
      MCPConfigManager.instance = new MCPConfigManager();
    }
    return MCPConfigManager.instance;
  }

  /**
   * Load configuration from environment variables and config files
   */
  private loadConfiguration(): MCPConfig {
    const baseConfig: MCPConfig = {
      servicenow: {
        instanceUrl: process.env.SERVICENOW_INSTANCE_URL || process.env.SERVICENOW_INSTANCE,
        clientId: process.env.SERVICENOW_CLIENT_ID,
        clientSecret: process.env.SERVICENOW_CLIENT_SECRET,
        oauthRedirectUri: process.env.SERVICENOW_OAUTH_REDIRECT_URI || 'http://localhost:8080/auth/callback',
        maxRetries: parseInt(process.env.SERVICENOW_MAX_RETRIES || '3'),
        timeout: parseInt(process.env.SERVICENOW_TIMEOUT || '30000')
      },
      neo4j: {
        uri: process.env.NEO4J_URI || process.env.NEO4J_URL,
        username: process.env.NEO4J_USERNAME || process.env.NEO4J_USER,
        password: process.env.NEO4J_PASSWORD || process.env.NEO4J_PASS,
        database: process.env.NEO4J_DATABASE || 'neo4j'
      },
      memory: {
        provider: (process.env.MEMORY_PROVIDER as 'file' | 'neo4j' | 'redis') || 'file',
        path: process.env.MEMORY_PATH || join(process.env.SNOW_FLOW_HOME || join(os.homedir(), '.snow-flow'), 'memory'),
        connectionString: process.env.MEMORY_CONNECTION_STRING,
        maxSize: parseInt(process.env.MEMORY_MAX_SIZE || '1000'),
        ttl: parseInt(process.env.MEMORY_TTL || '86400') // 24 hours
      },
      performance: {
        connectionPoolSize: parseInt(process.env.CONNECTION_POOL_SIZE || '10'),
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
        cacheEnabled: process.env.CACHE_ENABLED !== 'false',
        cacheTtl: parseInt(process.env.CACHE_TTL || '300') // 5 minutes
      },
      logging: {
        level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
        enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
        logPath: process.env.LOG_PATH || join(process.env.SNOW_FLOW_HOME || join(os.homedir(), '.snow-flow'), 'logs')
      }
    };

    // Try to load from config file if it exists
    const configPath = join(process.env.SNOW_FLOW_HOME || join(os.homedir(), '.snow-flow'), 'config.json');
    if (existsSync(configPath)) {
      try {
        const fileConfig = JSON.parse(readFileSync(configPath, 'utf8'));
        this.logger.info('Loaded configuration from config.json');
        return this.mergeConfigs(baseConfig, fileConfig);
      } catch (error) {
        this.logger.warn('Failed to load config.json, using environment variables');
      }
    }

    return baseConfig;
  }

  /**
   * Merge base configuration with file configuration
   */
  private mergeConfigs(base: MCPConfig, override: Partial<MCPConfig>): MCPConfig {
    return {
      servicenow: { ...base.servicenow, ...override.servicenow },
      neo4j: { ...base.neo4j, ...override.neo4j },
      memory: { ...base.memory, ...override.memory },
      performance: { ...base.performance, ...override.performance },
      logging: { ...base.logging, ...override.logging }
    };
  }

  /**
   * Get the complete configuration
   */
  public getConfig(): MCPConfig {
    return this.config;
  }

  /**
   * Get ServiceNow configuration
   */
  public getServiceNowConfig() {
    return this.config.servicenow;
  }

  /**
   * Get Neo4j configuration
   */
  public getNeo4jConfig() {
    return this.config.neo4j;
  }

  /**
   * Get memory configuration
   */
  public getMemoryConfig() {
    return this.config.memory;
  }

  /**
   * Get performance configuration
   */
  public getPerformanceConfig() {
    return this.config.performance;
  }

  /**
   * Get logging configuration
   */
  public getLoggingConfig() {
    return this.config.logging;
  }

  /**
   * Validate configuration
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate ServiceNow configuration
    if (!this.config.servicenow.instanceUrl) {
      errors.push('ServiceNow instance URL is required (SERVICENOW_INSTANCE_URL)');
    }
    if (!this.config.servicenow.clientId) {
      errors.push('ServiceNow client ID is required (SERVICENOW_CLIENT_ID)');
    }
    if (!this.config.servicenow.clientSecret) {
      errors.push('ServiceNow client secret is required (SERVICENOW_CLIENT_SECRET)');
    }

    // Validate Neo4j configuration if enabled
    if (this.config.memory.provider === 'neo4j') {
      if (!this.config.neo4j?.uri) {
        errors.push('Neo4j URI is required when using Neo4j memory provider (NEO4J_URI)');
      }
      if (!this.config.neo4j?.username) {
        errors.push('Neo4j username is required when using Neo4j memory provider (NEO4J_USERNAME)');
      }
      if (!this.config.neo4j?.password) {
        errors.push('Neo4j password is required when using Neo4j memory provider (NEO4J_PASSWORD)');
      }
    }

    // Validate memory configuration
    if (!['file', 'neo4j', 'redis'].includes(this.config.memory.provider)) {
      errors.push('Memory provider must be one of: file, neo4j, redis');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Hot reload configuration
   */
  public async reloadConfig(): Promise<void> {
    this.logger.info('Reloading configuration...');
    this.config = this.loadConfiguration();
    
    const validation = this.validateConfig();
    if (!validation.valid) {
      this.logger.error('Configuration validation failed:', validation.errors);
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    
    this.logger.info('Configuration reloaded successfully');
  }

  /**
   * Get environment-specific configuration
   */
  public getEnvironmentConfig(): { environment: string; config: MCPConfig } {
    const environment = process.env.NODE_ENV || 'development';
    
    // Environment-specific overrides
    const envOverrides: Partial<MCPConfig> = {};
    
    if (environment === 'production') {
      envOverrides.logging = {
        ...this.config.logging,
        level: 'warn',
        enableFileLogging: true
      };
      envOverrides.performance = {
        ...this.config.performance,
        cacheEnabled: true,
        connectionPoolSize: 20
      };
    } else if (environment === 'development') {
      envOverrides.logging = {
        ...this.config.logging,
        level: 'debug'
      };
    }

    return {
      environment,
      config: this.mergeConfigs(this.config, envOverrides)
    };
  }
}

// Export singleton instance
export const mcpConfig = MCPConfigManager.getInstance();