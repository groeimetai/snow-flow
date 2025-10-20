"use strict";
/**
 * Centralized MCP Configuration Manager
 * Handles dynamic configuration loading for all MCP servers
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpConfig = exports.MCPConfigManager = void 0;
const dotenv_1 = require("dotenv");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = __importDefault(require("os"));
const logger_js_1 = require("./logger.js");
// Load environment variables
(0, dotenv_1.config)();
class MCPConfigManager {
    constructor() {
        this.logger = new logger_js_1.Logger('MCPConfigManager');
        this.config = this.loadConfiguration();
    }
    static getInstance() {
        if (!MCPConfigManager.instance) {
            MCPConfigManager.instance = new MCPConfigManager();
        }
        return MCPConfigManager.instance;
    }
    /**
     * Load configuration from environment variables and config files
     */
    loadConfiguration() {
        const baseConfig = {
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
                provider: process.env.MEMORY_PROVIDER || 'file',
                path: process.env.MEMORY_PATH || (0, path_1.join)(process.env.SNOW_FLOW_HOME || (0, path_1.join)(os_1.default.homedir(), '.snow-flow'), 'memory'),
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
                level: process.env.LOG_LEVEL || 'info',
                enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
                logPath: process.env.LOG_PATH || (0, path_1.join)(process.env.SNOW_FLOW_HOME || (0, path_1.join)(os_1.default.homedir(), '.snow-flow'), 'logs')
            }
        };
        // Try to load from config file if it exists
        const configPath = (0, path_1.join)(process.env.SNOW_FLOW_HOME || (0, path_1.join)(os_1.default.homedir(), '.snow-flow'), 'config.json');
        if ((0, fs_1.existsSync)(configPath)) {
            try {
                const fileConfig = JSON.parse((0, fs_1.readFileSync)(configPath, 'utf8'));
                this.logger.info('Loaded configuration from config.json');
                return this.mergeConfigs(baseConfig, fileConfig);
            }
            catch (error) {
                this.logger.warn('Failed to load config.json, using environment variables');
            }
        }
        return baseConfig;
    }
    /**
     * Merge base configuration with file configuration
     */
    mergeConfigs(base, override) {
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
    getConfig() {
        return this.config;
    }
    /**
     * Get ServiceNow configuration
     */
    getServiceNowConfig() {
        return this.config.servicenow;
    }
    /**
     * Get Neo4j configuration
     */
    getNeo4jConfig() {
        return this.config.neo4j;
    }
    /**
     * Get memory configuration
     */
    getMemoryConfig() {
        return this.config.memory;
    }
    /**
     * Get performance configuration
     */
    getPerformanceConfig() {
        return this.config.performance;
    }
    /**
     * Get logging configuration
     */
    getLoggingConfig() {
        return this.config.logging;
    }
    /**
     * Validate configuration
     */
    validateConfig() {
        const errors = [];
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
    async reloadConfig() {
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
    getEnvironmentConfig() {
        const environment = process.env.NODE_ENV || 'development';
        // Environment-specific overrides
        const envOverrides = {};
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
        }
        else if (environment === 'development') {
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
exports.MCPConfigManager = MCPConfigManager;
// Export singleton instance
exports.mcpConfig = MCPConfigManager.getInstance();
//# sourceMappingURL=mcp-config-manager.js.map