/**
 * Snow-Flow Configuration Management
 * Central configuration for all system components
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { z } from 'zod';

// Configuration Schema using Zod for validation
const ConfigSchema = z.object({
  // System-wide settings
  system: z
    .object({
      environment: z.enum(['development', 'staging', 'production']).default('development'),
      logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      dataDir: z
        .string()
        .default(process.env.SNOW_FLOW_HOME || path.join(os.homedir(), '.snow-flow')),
      maxConcurrentOperations: z.number().min(1).max(100).default(10),
      sessionTimeout: z.number().min(300000).default(3600000), // 1 hour default
    })
    .default({}),

  // Agent configuration
  agents: z
    .object({
      queen: z
        .object({
          maxWorkerAgents: z.number().min(1).max(50).default(10),
          spawnTimeout: z.number().min(5000).default(30000),
          coordinationInterval: z.number().min(1000).default(5000),
          decisionThreshold: z.number().min(0).max(1).default(0.7),
          retryAttempts: z.number().min(1).max(10).default(3),
        })
        .default({}),
      worker: z
        .object({
          heartbeatInterval: z.number().min(1000).default(10000),
          taskTimeout: z.number().min(60000).default(300000), // 5 minutes
          maxMemoryUsage: z.number().min(100).default(500), // MB
          autoShutdownIdle: z.number().min(60000).default(600000), // 10 minutes
        })
        .default({}),
      specializations: z
        .object({
          widgetCreator: z
            .object({
              enabled: z.boolean().default(true),
              priority: z.number().min(1).max(10).default(8),
              capabilities: z
                .array(z.string())
                .default(['html', 'css', 'javascript', 'servicenow-api']),
            })
            .default({}),
          flowBuilder: z
            .object({
              enabled: z.boolean().default(true),
              priority: z.number().min(1).max(10).default(8),
              capabilities: z
                .array(z.string())
                .default(['flow-designer', 'triggers', 'actions', 'approvals']),
            })
            .default({}),
          scriptWriter: z
            .object({
              enabled: z.boolean().default(true),
              priority: z.number().min(1).max(10).default(7),
              capabilities: z
                .array(z.string())
                .default(['business-rules', 'script-includes', 'client-scripts']),
            })
            .default({}),
          securityAgent: z
            .object({
              enabled: z.boolean().default(true),
              priority: z.number().min(1).max(10).default(9),
              capabilities: z.array(z.string()).default(['acl', 'security-scan', 'compliance']),
            })
            .default({}),
          testAgent: z
            .object({
              enabled: z.boolean().default(true),
              priority: z.number().min(1).max(10).default(6),
              capabilities: z
                .array(z.string())
                .default(['unit-test', 'integration-test', 'performance-test']),
            })
            .default({}),
        })
        .default({}),
    })
    .default({}),

  // Memory system configuration
  memory: z
    .object({
      dbPath: z.string().optional(),
      schema: z
        .object({
          version: z.string().default('1.0.0'),
          autoMigrate: z.boolean().default(true),
        })
        .default({}),
      cache: z
        .object({
          enabled: z.boolean().default(true),
          maxSize: z.number().min(10).default(100), // MB
          ttl: z.number().min(60000).default(3600000), // 1 hour
        })
        .default({}),
      ttl: z
        .object({
          default: z.number().min(3600000).default(86400000), // 24 hours
          session: z.number().min(3600000).default(86400000), // 24 hours
          artifact: z.number().min(86400000).default(604800000), // 7 days
          metric: z.number().min(86400000).default(2592000000), // 30 days
        })
        .default({}),
      cleanup: z
        .object({
          enabled: z.boolean().default(true),
          interval: z.number().min(3600000).default(86400000), // 24 hours
          retentionDays: z.number().min(7).default(30),
        })
        .default({}),
    })
    .default({}),

  // MCP server configuration
  mcp: z
    .object({
      servers: z
        .object({
          deployment: z
            .object({
              enabled: z.boolean().default(true),
              port: z.number().min(3000).max(65535).default(3001),
              host: z.string().default('localhost'),
            })
            .default({}),
          intelligent: z
            .object({
              enabled: z.boolean().default(true),
              port: z.number().min(3000).max(65535).default(3002),
              host: z.string().default('localhost'),
            })
            .default({}),
          operations: z
            .object({
              enabled: z.boolean().default(true),
              port: z.number().min(3000).max(65535).default(3003),
              host: z.string().default('localhost'),
            })
            .default({}),
          flowComposer: z
            .object({
              enabled: z.boolean().default(true),
              port: z.number().min(3000).max(65535).default(3004),
              host: z.string().default('localhost'),
            })
            .default({}),
          platformDevelopment: z
            .object({
              enabled: z.boolean().default(true),
              port: z.number().min(3000).max(65535).default(3005),
              host: z.string().default('localhost'),
            })
            .default({}),
        })
        .default({}),
      transport: z
        .object({
          type: z.enum(['stdio', 'http', 'websocket']).default('stdio'),
          timeout: z.number().min(0).default(30000), // Allow 0 to disable timeout, or set via MCP_TIMEOUT env var
          retryAttempts: z.number().min(1).max(10).default(3),
          retryDelay: z.number().min(1000).default(5000),
        })
        .default({}),
      authentication: z
        .object({
          required: z.boolean().default(true),
          tokenExpiry: z.number().min(3600000).default(86400000), // 24 hours
        })
        .default({}),
    })
    .default({}),

  // ServiceNow connection settings
  servicenow: z
    .object({
      instance: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      authType: z.enum(['oauth', 'basic']).default('oauth'),
      apiVersion: z.string().default('now'),
      timeout: z.number().min(5000).default(60000),
      retryConfig: z
        .object({
          maxRetries: z.number().min(0).max(10).default(3),
          retryDelay: z.number().min(1000).default(2000),
          backoffMultiplier: z.number().min(1).max(5).default(2),
        })
        .default({}),
      cache: z
        .object({
          enabled: z.boolean().default(true),
          ttl: z.number().min(60000).default(300000), // 5 minutes
          maxSize: z.number().min(10).default(50), // MB
        })
        .default({}),
      oauth: z
        .object({
          redirectHost: z.string().default('localhost'),
          redirectPort: z.number().min(3000).max(65535).default(3005),
          redirectPath: z.string().default('/callback'),
        })
        .default({}),
    })
    .default({}),

  // Monitoring configuration
  monitoring: z
    .object({
      performance: z
        .object({
          enabled: z.boolean().default(true),
          sampleRate: z.number().min(0).max(1).default(1),
          metricsRetention: z.number().min(86400000).default(604800000), // 7 days
          aggregationInterval: z.number().min(60000).default(300000), // 5 minutes
        })
        .default({}),
      health: z
        .object({
          enabled: z.boolean().default(true),
          checkInterval: z.number().min(30000).default(60000), // 1 minute
          endpoints: z.array(z.string()).default([]),
          thresholds: z
            .object({
              memoryUsage: z.number().min(0).max(1).default(0.8), // 80%
              cpuUsage: z.number().min(0).max(1).default(0.8), // 80%
              errorRate: z.number().min(0).max(1).default(0.05), // 5%
            })
            .default({}),
        })
        .default({}),
      alerts: z
        .object({
          enabled: z.boolean().default(true),
          channels: z.array(z.enum(['console', 'file', 'webhook'])).default(['console']),
          webhookUrl: z.string().url().optional(),
          severityThreshold: z.enum(['info', 'warn', 'error']).default('warn'),
        })
        .default({}),
    })
    .default({}),

  // Health check configuration
  health: z
    .object({
      checks: z
        .object({
          memory: z.boolean().default(true),
          mcp: z.boolean().default(true),
          servicenow: z.boolean().default(true),
          queen: z.boolean().default(true),
        })
        .default({}),
      thresholds: z
        .object({
          responseTime: z.number().min(100).default(5000), // ms
          memoryUsage: z.number().min(100).default(1000), // MB
          queueSize: z.number().min(10).default(100),
        })
        .default({}),
    })
    .default({}),

  // Feature flags
  features: z
    .object({
      autoPermissions: z.boolean().default(false),
      smartDiscovery: z.boolean().default(true),
      liveTesting: z.boolean().default(true),
      autoDeploy: z.boolean().default(true),
      autoRollback: z.boolean().default(true),
      sharedMemory: z.boolean().default(true),
      progressMonitoring: z.boolean().default(true),
      neuralPatterns: z.boolean().default(false),
      cognitiveAnalysis: z.boolean().default(false),
    })
    .default({}),
});

export type ISnowFlowConfig = z.infer<typeof ConfigSchema>;

export class SnowFlowConfig {
  private config: ISnowFlowConfig;
  private configPath: string;

  constructor(overrides?: Partial<ISnowFlowConfig>) {
    // Determine config path
    this.configPath = path.join(os.homedir(), '.snow-flow', 'config.json');

    // Load config from file if exists
    const fileConfig = this.loadFromFile();

    // Load environment variables
    const envConfig = this.loadFromEnvironment();

    // Merge configurations: defaults < file < env < overrides
    const mergedConfig = this.mergeConfigs(
      this.getDefaults(),
      fileConfig,
      envConfig,
      overrides || {}
    );

    // Validate configuration
    const result = ConfigSchema.safeParse(mergedConfig);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${JSON.stringify(result.error.errors)}`);
    }

    this.config = result.data;

    // Ensure data directories exist
    this.ensureDirectories();
  }

  /**
   * Get the current configuration
   */
  get(): ISnowFlowConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  update(updates: Partial<ISnowFlowConfig>): void {
    const mergedConfig = this.mergeConfigs(this.config, updates);

    const result = ConfigSchema.safeParse(mergedConfig);
    if (!result.success) {
      throw new Error(`Invalid configuration update: ${JSON.stringify(result.error.errors)}`);
    }

    this.config = result.data;
    this.saveToFile();
  }

  /**
   * Get a specific configuration value
   */
  getValue(path: string): any {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a specific configuration value
   */
  setValue(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let obj: any = this.config;

    for (const key of keys) {
      if (!obj[key] || typeof obj[key] !== 'object') {
        obj[key] = {};
      }
      obj = obj[key];
    }

    obj[lastKey] = value;
    this.update(this.config);
  }

  /**
   * Save configuration to file
   */
  saveToFile(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  /**
   * Load configuration from file
   */
  private loadFromFile(): Partial<ISnowFlowConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load configuration from file:', error);
    }
    return {};
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): Partial<ISnowFlowConfig> {
    const env: any = {};

    // ServiceNow settings
    if (process.env.SNOW_INSTANCE) {
      env.servicenow = env.servicenow || {};
      env.servicenow.instance = process.env.SNOW_INSTANCE;
    }
    if (process.env.SNOW_CLIENT_ID) {
      env.servicenow = env.servicenow || {};
      env.servicenow.clientId = process.env.SNOW_CLIENT_ID;
    }
    if (process.env.SNOW_CLIENT_SECRET) {
      env.servicenow = env.servicenow || {};
      env.servicenow.clientSecret = process.env.SNOW_CLIENT_SECRET;
    }
    if (process.env.SNOW_USERNAME) {
      env.servicenow = env.servicenow || {};
      env.servicenow.username = process.env.SNOW_USERNAME;
    }
    if (process.env.SNOW_PASSWORD) {
      env.servicenow = env.servicenow || {};
      env.servicenow.password = process.env.SNOW_PASSWORD;
    }
    if (process.env.SNOW_AUTH_TYPE) {
      env.servicenow = env.servicenow || {};
      env.servicenow.authType = process.env.SNOW_AUTH_TYPE;
    }
    if (process.env.SNOW_API_VERSION) {
      env.servicenow = env.servicenow || {};
      env.servicenow.apiVersion = process.env.SNOW_API_VERSION;
    }
    if (process.env.SNOW_REQUEST_TIMEOUT) {
      env.servicenow = env.servicenow || {};
      const value = parseInt(process.env.SNOW_REQUEST_TIMEOUT);
      if (!isNaN(value)) {
        env.servicenow.timeout = value;
      }
    }
    if (process.env.SNOW_MAX_RETRIES) {
      env.servicenow = env.servicenow || {};
      env.servicenow.retryConfig = env.servicenow.retryConfig || {};
      const value = parseInt(process.env.SNOW_MAX_RETRIES);
      if (!isNaN(value)) {
        env.servicenow.retryConfig.maxRetries = value;
      }
    }
    if (process.env.SNOW_RETRY_DELAY) {
      env.servicenow = env.servicenow || {};
      env.servicenow.retryConfig = env.servicenow.retryConfig || {};
      const value = parseInt(process.env.SNOW_RETRY_DELAY);
      if (!isNaN(value)) {
        env.servicenow.retryConfig.retryDelay = value;
      }
    }
    if (process.env.SNOW_REDIRECT_HOST) {
      env.servicenow = env.servicenow || {};
      env.servicenow.oauth = env.servicenow.oauth || {};
      env.servicenow.oauth.redirectHost = process.env.SNOW_REDIRECT_HOST;
    }
    if (process.env.SNOW_REDIRECT_PORT) {
      env.servicenow = env.servicenow || {};
      env.servicenow.oauth = env.servicenow.oauth || {};
      const value = parseInt(process.env.SNOW_REDIRECT_PORT);
      if (!isNaN(value)) {
        env.servicenow.oauth.redirectPort = value;
      }
    }
    if (process.env.SNOW_REDIRECT_PATH) {
      env.servicenow = env.servicenow || {};
      env.servicenow.oauth = env.servicenow.oauth || {};
      env.servicenow.oauth.redirectPath = process.env.SNOW_REDIRECT_PATH;
    }

    // System settings
    if (process.env.SNOW_FLOW_ENV) {
      env.system = env.system || {};
      env.system.environment = process.env.SNOW_FLOW_ENV;
    }
    if (process.env.SNOW_FLOW_LOG_LEVEL) {
      env.system = env.system || {};
      env.system.logLevel = process.env.SNOW_FLOW_LOG_LEVEL;
    }
    if (process.env.SNOW_FLOW_DATA_DIR) {
      env.system = env.system || {};
      env.system.dataDir = process.env.SNOW_FLOW_DATA_DIR;
    }
    if (process.env.SNOW_FLOW_MAX_CONCURRENT_OPS) {
      env.system = env.system || {};
      const value = parseInt(process.env.SNOW_FLOW_MAX_CONCURRENT_OPS);
      if (!isNaN(value)) {
        env.system.maxConcurrentOperations = value;
      }
    }
    if (process.env.SNOW_FLOW_SESSION_TIMEOUT) {
      env.system = env.system || {};
      const value = parseInt(process.env.SNOW_FLOW_SESSION_TIMEOUT);
      if (!isNaN(value)) {
        env.system.sessionTimeout = value;
      }
    }

    // Agent configuration
    if (process.env.SNOW_FLOW_MAX_WORKER_AGENTS) {
      env.agents = env.agents || {};
      env.agents.queen = env.agents.queen || {};
      const value = parseInt(process.env.SNOW_FLOW_MAX_WORKER_AGENTS);
      if (!isNaN(value)) {
        env.agents.queen.maxWorkerAgents = value;
      }
    }
    if (process.env.SNOW_FLOW_SPAWN_TIMEOUT) {
      env.agents = env.agents || {};
      env.agents.queen = env.agents.queen || {};
      const value = parseInt(process.env.SNOW_FLOW_SPAWN_TIMEOUT);
      if (!isNaN(value)) {
        env.agents.queen.spawnTimeout = value;
      }
    }
    if (process.env.SNOW_FLOW_COORDINATION_INTERVAL) {
      env.agents = env.agents || {};
      env.agents.queen = env.agents.queen || {};
      const value = parseInt(process.env.SNOW_FLOW_COORDINATION_INTERVAL);

      if (!isNaN(value)) {
        env.agents.queen.coordinationInterval = value;
      }
    }
    if (process.env.SNOW_FLOW_RETRY_ATTEMPTS) {
      env.agents = env.agents || {};
      env.agents.queen = env.agents.queen || {};
      const value = parseInt(process.env.SNOW_FLOW_RETRY_ATTEMPTS);

      if (!isNaN(value)) {
        env.agents.queen.retryAttempts = value;
      }
    }
    if (process.env.SNOW_FLOW_HEARTBEAT_INTERVAL) {
      env.agents = env.agents || {};
      env.agents.worker = env.agents.worker || {};
      const value = parseInt(process.env.SNOW_FLOW_HEARTBEAT_INTERVAL);

      if (!isNaN(value)) {
        env.agents.worker.heartbeatInterval = value;
      }
    }
    if (process.env.SNOW_FLOW_TASK_TIMEOUT) {
      env.agents = env.agents || {};
      env.agents.worker = env.agents.worker || {};
      const value = parseInt(process.env.SNOW_FLOW_TASK_TIMEOUT);

      if (!isNaN(value)) {
        env.agents.worker.taskTimeout = value;
      }
    }
    if (process.env.SNOW_FLOW_MAX_MEMORY_USAGE) {
      env.agents = env.agents || {};
      env.agents.worker = env.agents.worker || {};
      const value = parseInt(process.env.SNOW_FLOW_MAX_MEMORY_USAGE);

      if (!isNaN(value)) {
        env.agents.worker.maxMemoryUsage = value;
      }
    }
    if (process.env.SNOW_FLOW_AUTO_SHUTDOWN_IDLE) {
      env.agents = env.agents || {};
      env.agents.worker = env.agents.worker || {};
      const value = parseInt(process.env.SNOW_FLOW_AUTO_SHUTDOWN_IDLE);

      if (!isNaN(value)) {
        env.agents.worker.autoShutdownIdle = value;
      }
    }

    // MCP server configuration
    if (process.env.MCP_DEPLOYMENT_PORT) {
      env.mcp = env.mcp || {};
      env.mcp.servers = env.mcp.servers || {};
      env.mcp.servers.deployment = env.mcp.servers.deployment || {};
      const value = parseInt(process.env.MCP_DEPLOYMENT_PORT);

      if (!isNaN(value)) {
        env.mcp.servers.deployment.port = value;
      }
    }
    if (process.env.MCP_INTELLIGENT_PORT) {
      env.mcp = env.mcp || {};
      env.mcp.servers = env.mcp.servers || {};
      env.mcp.servers.intelligent = env.mcp.servers.intelligent || {};
      const value = parseInt(process.env.MCP_INTELLIGENT_PORT);

      if (!isNaN(value)) {
        env.mcp.servers.intelligent.port = value;
      }
    }
    if (process.env.MCP_OPERATIONS_PORT) {
      env.mcp = env.mcp || {};
      env.mcp.servers = env.mcp.servers || {};
      env.mcp.servers.operations = env.mcp.servers.operations || {};
      const value = parseInt(process.env.MCP_OPERATIONS_PORT);

      if (!isNaN(value)) {
        env.mcp.servers.operations.port = value;
      }
    }
    if (process.env.MCP_FLOW_COMPOSER_PORT) {
      env.mcp = env.mcp || {};
      env.mcp.servers = env.mcp.servers || {};
      env.mcp.servers.flowComposer = env.mcp.servers.flowComposer || {};
      const value = parseInt(process.env.MCP_FLOW_COMPOSER_PORT);

      if (!isNaN(value)) {
        env.mcp.servers.flowComposer.port = value;
      }
    }
    if (process.env.MCP_PLATFORM_DEV_PORT) {
      env.mcp = env.mcp || {};
      env.mcp.servers = env.mcp.servers || {};
      env.mcp.servers.platformDevelopment = env.mcp.servers.platformDevelopment || {};
      const value = parseInt(process.env.MCP_PLATFORM_DEV_PORT);

      if (!isNaN(value)) {
        env.mcp.servers.platformDevelopment.port = value;
      }
    }
    if (process.env.MCP_HOST) {
      env.mcp = env.mcp || {};
      env.mcp.servers = env.mcp.servers || {};
      // Apply to all servers
      ['deployment', 'intelligent', 'operations', 'flowComposer', 'platformDevelopment'].forEach(
        (server) => {
          env.mcp.servers[server] = env.mcp.servers[server] || {};
          env.mcp.servers[server].host = process.env.MCP_HOST;
        }
      );
    }
    if (process.env.MCP_TIMEOUT) {
      env.mcp = env.mcp || {};
      env.mcp.transport = env.mcp.transport || {};
      const value = parseInt(process.env.MCP_TIMEOUT);

      if (!isNaN(value)) {
        env.mcp.transport.timeout = value;
      }
    }
    if (process.env.MCP_RETRY_ATTEMPTS) {
      env.mcp = env.mcp || {};
      env.mcp.transport = env.mcp.transport || {};
      const value = parseInt(process.env.MCP_RETRY_ATTEMPTS);

      if (!isNaN(value)) {
        env.mcp.transport.retryAttempts = value;
      }
    }
    if (process.env.MCP_RETRY_DELAY) {
      env.mcp = env.mcp || {};
      env.mcp.transport = env.mcp.transport || {};
      const value = parseInt(process.env.MCP_RETRY_DELAY);

      if (!isNaN(value)) {
        env.mcp.transport.retryDelay = value;
      }
    }
    if (process.env.MCP_AUTH_TOKEN_EXPIRY) {
      env.mcp = env.mcp || {};
      env.mcp.authentication = env.mcp.authentication || {};
      const value = parseInt(process.env.MCP_AUTH_TOKEN_EXPIRY);

      if (!isNaN(value)) {
        env.mcp.authentication.tokenExpiry = value;
      }
    }

    // Memory system configuration
    if (process.env.SNOW_FLOW_DB_PATH) {
      env.memory = env.memory || {};
      env.memory.dbPath = process.env.SNOW_FLOW_DB_PATH;
    }
    if (process.env.SNOW_FLOW_CACHE_ENABLED) {
      env.memory = env.memory || {};
      env.memory.cache = env.memory.cache || {};
      env.memory.cache.enabled = process.env.SNOW_FLOW_CACHE_ENABLED === 'true';
    }
    if (process.env.SNOW_FLOW_CACHE_MAX_SIZE) {
      env.memory = env.memory || {};
      env.memory.cache = env.memory.cache || {};
      const value = parseInt(process.env.SNOW_FLOW_CACHE_MAX_SIZE);

      if (!isNaN(value)) {
        env.memory.cache.maxSize = value;
      }
    }
    if (process.env.SNOW_FLOW_CACHE_TTL) {
      env.memory = env.memory || {};
      env.memory.cache = env.memory.cache || {};
      const value = parseInt(process.env.SNOW_FLOW_CACHE_TTL);

      if (!isNaN(value)) {
        env.memory.cache.ttl = value;
      }
    }
    if (process.env.SNOW_FLOW_DEFAULT_TTL) {
      env.memory = env.memory || {};
      env.memory.ttl = env.memory.ttl || {};
      const value = parseInt(process.env.SNOW_FLOW_DEFAULT_TTL);

      if (!isNaN(value)) {
        env.memory.ttl.default = value;
      }
    }
    if (process.env.SNOW_FLOW_SESSION_TTL) {
      env.memory = env.memory || {};
      env.memory.ttl = env.memory.ttl || {};
      const value = parseInt(process.env.SNOW_FLOW_SESSION_TTL);

      if (!isNaN(value)) {
        env.memory.ttl.session = value;
      }
    }
    if (process.env.SNOW_FLOW_ARTIFACT_TTL) {
      env.memory = env.memory || {};
      env.memory.ttl = env.memory.ttl || {};
      const value = parseInt(process.env.SNOW_FLOW_ARTIFACT_TTL);

      if (!isNaN(value)) {
        env.memory.ttl.artifact = value;
      }
    }
    if (process.env.SNOW_FLOW_METRIC_TTL) {
      env.memory = env.memory || {};
      env.memory.ttl = env.memory.ttl || {};
      const value = parseInt(process.env.SNOW_FLOW_METRIC_TTL);

      if (!isNaN(value)) {
        env.memory.ttl.metric = value;
      }
    }
    if (process.env.SNOW_FLOW_CLEANUP_INTERVAL) {
      env.memory = env.memory || {};
      env.memory.cleanup = env.memory.cleanup || {};
      const value = parseInt(process.env.SNOW_FLOW_CLEANUP_INTERVAL);

      if (!isNaN(value)) {
        env.memory.cleanup.interval = value;
      }
    }
    if (process.env.SNOW_FLOW_RETENTION_DAYS) {
      env.memory = env.memory || {};
      env.memory.cleanup = env.memory.cleanup || {};
      const value = parseInt(process.env.SNOW_FLOW_RETENTION_DAYS);

      if (!isNaN(value)) {
        env.memory.cleanup.retentionDays = value;
      }
    }

    // Monitoring configuration
    if (process.env.SNOW_FLOW_PERFORMANCE_ENABLED) {
      env.monitoring = env.monitoring || {};
      env.monitoring.performance = env.monitoring.performance || {};
      env.monitoring.performance.enabled = process.env.SNOW_FLOW_PERFORMANCE_ENABLED === 'true';
    }
    if (process.env.SNOW_FLOW_SAMPLE_RATE) {
      env.monitoring = env.monitoring || {};
      env.monitoring.performance = env.monitoring.performance || {};
      const floatValue = parseFloat(process.env.SNOW_FLOW_SAMPLE_RATE);

      if (!isNaN(floatValue)) {
        env.monitoring.performance.sampleRate = floatValue;
      }
    }
    if (process.env.SNOW_FLOW_METRICS_RETENTION) {
      env.monitoring = env.monitoring || {};
      env.monitoring.performance = env.monitoring.performance || {};
      const value = parseInt(process.env.SNOW_FLOW_METRICS_RETENTION);

      if (!isNaN(value)) {
        env.monitoring.performance.metricsRetention = value;
      }
    }
    if (process.env.SNOW_FLOW_AGGREGATION_INTERVAL) {
      env.monitoring = env.monitoring || {};
      env.monitoring.performance = env.monitoring.performance || {};
      const value = parseInt(process.env.SNOW_FLOW_AGGREGATION_INTERVAL);

      if (!isNaN(value)) {
        env.monitoring.performance.aggregationInterval = value;
      }
    }
    if (process.env.SNOW_FLOW_HEALTH_CHECK_INTERVAL) {
      env.monitoring = env.monitoring || {};
      env.monitoring.health = env.monitoring.health || {};
      const value = parseInt(process.env.SNOW_FLOW_HEALTH_CHECK_INTERVAL);

      if (!isNaN(value)) {
        env.monitoring.health.checkInterval = value;
      }
    }
    if (process.env.SNOW_FLOW_MEMORY_THRESHOLD) {
      env.monitoring = env.monitoring || {};
      env.monitoring.health = env.monitoring.health || {};
      env.monitoring.health.thresholds = env.monitoring.health.thresholds || {};
      const floatValue = parseFloat(process.env.SNOW_FLOW_MEMORY_THRESHOLD);

      if (!isNaN(floatValue)) {
        env.monitoring.health.thresholds.memoryUsage = floatValue;
      }
    }
    if (process.env.SNOW_FLOW_CPU_THRESHOLD) {
      env.monitoring = env.monitoring || {};
      env.monitoring.health = env.monitoring.health || {};
      env.monitoring.health.thresholds = env.monitoring.health.thresholds || {};
      const floatValue = parseFloat(process.env.SNOW_FLOW_CPU_THRESHOLD);

      if (!isNaN(floatValue)) {
        env.monitoring.health.thresholds.cpuUsage = floatValue;
      }
    }
    if (process.env.SNOW_FLOW_ERROR_RATE_THRESHOLD) {
      env.monitoring = env.monitoring || {};
      env.monitoring.health = env.monitoring.health || {};
      env.monitoring.health.thresholds = env.monitoring.health.thresholds || {};
      const floatValue = parseFloat(process.env.SNOW_FLOW_ERROR_RATE_THRESHOLD);

      if (!isNaN(floatValue)) {
        env.monitoring.health.thresholds.errorRate = floatValue;
      }
    }
    if (process.env.SNOW_FLOW_WEBHOOK_URL) {
      env.monitoring = env.monitoring || {};
      env.monitoring.alerts = env.monitoring.alerts || {};
      env.monitoring.alerts.webhookUrl = process.env.SNOW_FLOW_WEBHOOK_URL;
    }
    if (process.env.SNOW_FLOW_ALERT_SEVERITY) {
      env.monitoring = env.monitoring || {};
      env.monitoring.alerts = env.monitoring.alerts || {};
      env.monitoring.alerts.severityThreshold = process.env.SNOW_FLOW_ALERT_SEVERITY;
    }

    // Health check thresholds
    if (process.env.SNOW_FLOW_RESPONSE_TIME_THRESHOLD) {
      env.health = env.health || {};
      env.health.thresholds = env.health.thresholds || {};
      const value = parseInt(process.env.SNOW_FLOW_RESPONSE_TIME_THRESHOLD);

      if (!isNaN(value)) {
        env.health.thresholds.responseTime = value;
      }
    }
    if (process.env.SNOW_FLOW_HEALTH_MEMORY_THRESHOLD) {
      env.health = env.health || {};
      env.health.thresholds = env.health.thresholds || {};
      const value = parseInt(process.env.SNOW_FLOW_HEALTH_MEMORY_THRESHOLD);

      if (!isNaN(value)) {
        env.health.thresholds.memoryUsage = value;
      }
    }
    if (process.env.SNOW_FLOW_QUEUE_SIZE_THRESHOLD) {
      env.health = env.health || {};
      env.health.thresholds = env.health.thresholds || {};
      const value = parseInt(process.env.SNOW_FLOW_QUEUE_SIZE_THRESHOLD);

      if (!isNaN(value)) {
        env.health.thresholds.queueSize = value;
      }
    }

    // Feature flags
    if (process.env.SNOW_FLOW_AUTO_PERMISSIONS) {
      env.features = env.features || {};
      env.features.autoPermissions = process.env.SNOW_FLOW_AUTO_PERMISSIONS === 'true';
    }
    if (process.env.SNOW_FLOW_SMART_DISCOVERY) {
      env.features = env.features || {};
      env.features.smartDiscovery = process.env.SNOW_FLOW_SMART_DISCOVERY === 'true';
    }
    if (process.env.SNOW_FLOW_LIVE_TESTING) {
      env.features = env.features || {};
      env.features.liveTesting = process.env.SNOW_FLOW_LIVE_TESTING === 'true';
    }
    if (process.env.SNOW_FLOW_AUTO_DEPLOY) {
      env.features = env.features || {};
      env.features.autoDeploy = process.env.SNOW_FLOW_AUTO_DEPLOY === 'true';
    }
    if (process.env.SNOW_FLOW_AUTO_ROLLBACK) {
      env.features = env.features || {};
      env.features.autoRollback = process.env.SNOW_FLOW_AUTO_ROLLBACK === 'true';
    }
    if (process.env.SNOW_FLOW_SHARED_MEMORY) {
      env.features = env.features || {};
      env.features.sharedMemory = process.env.SNOW_FLOW_SHARED_MEMORY === 'true';
    }
    if (process.env.SNOW_FLOW_PROGRESS_MONITORING) {
      env.features = env.features || {};
      env.features.progressMonitoring = process.env.SNOW_FLOW_PROGRESS_MONITORING === 'true';
    }
    if (process.env.SNOW_FLOW_NEURAL_PATTERNS) {
      env.features = env.features || {};
      env.features.neuralPatterns = process.env.SNOW_FLOW_NEURAL_PATTERNS === 'true';
    }
    if (process.env.SNOW_FLOW_COGNITIVE_ANALYSIS) {
      env.features = env.features || {};
      env.features.cognitiveAnalysis = process.env.SNOW_FLOW_COGNITIVE_ANALYSIS === 'true';
    }

    return env;
  }

  /**
   * Get default configuration
   */
  private getDefaults(): ISnowFlowConfig {
    return ConfigSchema.parse({});
  }

  /**
   * Merge multiple configuration objects
   */
  private mergeConfigs(...configs: Array<Partial<ISnowFlowConfig>>): ISnowFlowConfig {
    const merged: any = {};

    for (const config of configs) {
      this.deepMerge(merged, config);
    }

    return merged as ISnowFlowConfig;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.config.system.dataDir,
      path.join(this.config.system.dataDir, 'memory'),
      path.join(this.config.system.dataDir, 'logs'),
      path.join(this.config.system.dataDir, 'cache'),
      path.join(this.config.system.dataDir, 'sessions'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  // Convenience getters
  get system() {
    return this.config.system;
  }
  get agents() {
    return this.config.agents;
  }
  get memory() {
    return this.config.memory;
  }
  get mcp() {
    return this.config.mcp;
  }
  get servicenow() {
    return this.config.servicenow;
  }
  get monitoring() {
    return this.config.monitoring;
  }
  get health() {
    return this.config.health;
  }
  get features() {
    return this.config.features;
  }
}

// Export singleton instance
export const snowFlowConfig = new SnowFlowConfig();
