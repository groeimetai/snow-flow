/**
 * Centralized MCP Configuration Manager
 * Handles dynamic configuration loading for all MCP servers
 */
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
export declare class MCPConfigManager {
    private static instance;
    private config;
    private logger;
    private constructor();
    static getInstance(): MCPConfigManager;
    /**
     * Load configuration from environment variables and config files
     */
    private loadConfiguration;
    /**
     * Merge base configuration with file configuration
     */
    private mergeConfigs;
    /**
     * Get the complete configuration
     */
    getConfig(): MCPConfig;
    /**
     * Get ServiceNow configuration
     */
    getServiceNowConfig(): {
        instanceUrl?: string;
        clientId?: string;
        clientSecret?: string;
        oauthRedirectUri?: string;
        maxRetries?: number;
        timeout?: number;
    };
    /**
     * Get Neo4j configuration
     */
    getNeo4jConfig(): {
        uri?: string;
        username?: string;
        password?: string;
        database?: string;
    };
    /**
     * Get memory configuration
     */
    getMemoryConfig(): {
        provider: "file" | "neo4j" | "redis";
        path?: string;
        connectionString?: string;
        maxSize?: number;
        ttl?: number;
    };
    /**
     * Get performance configuration
     */
    getPerformanceConfig(): {
        connectionPoolSize?: number;
        requestTimeout?: number;
        retryAttempts?: number;
        cacheEnabled?: boolean;
        cacheTtl?: number;
    };
    /**
     * Get logging configuration
     */
    getLoggingConfig(): {
        level: "debug" | "info" | "warn" | "error";
        enableFileLogging?: boolean;
        logPath?: string;
    };
    /**
     * Validate configuration
     */
    validateConfig(): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Hot reload configuration
     */
    reloadConfig(): Promise<void>;
    /**
     * Get environment-specific configuration
     */
    getEnvironmentConfig(): {
        environment: string;
        config: MCPConfig;
    };
}
export declare const mcpConfig: MCPConfigManager;
//# sourceMappingURL=mcp-config-manager.d.ts.map