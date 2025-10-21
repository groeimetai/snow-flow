/**
 * Snow-Flow Configuration Management
 * Central configuration for all system components
 */
import { z } from 'zod';
declare const ConfigSchema: z.ZodObject<{
    system: z.ZodDefault<z.ZodObject<{
        environment: z.ZodDefault<z.ZodEnum<{
            development: "development";
            staging: "staging";
            production: "production";
        }>>;
        logLevel: z.ZodDefault<z.ZodEnum<{
            debug: "debug";
            info: "info";
            warn: "warn";
            error: "error";
        }>>;
        dataDir: z.ZodDefault<z.ZodString>;
        maxConcurrentOperations: z.ZodDefault<z.ZodNumber>;
        sessionTimeout: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    agents: z.ZodDefault<z.ZodObject<{
        queen: z.ZodDefault<z.ZodObject<{
            maxWorkerAgents: z.ZodDefault<z.ZodNumber>;
            spawnTimeout: z.ZodDefault<z.ZodNumber>;
            coordinationInterval: z.ZodDefault<z.ZodNumber>;
            decisionThreshold: z.ZodDefault<z.ZodNumber>;
            retryAttempts: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        worker: z.ZodDefault<z.ZodObject<{
            heartbeatInterval: z.ZodDefault<z.ZodNumber>;
            taskTimeout: z.ZodDefault<z.ZodNumber>;
            maxMemoryUsage: z.ZodDefault<z.ZodNumber>;
            autoShutdownIdle: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        specializations: z.ZodDefault<z.ZodObject<{
            widgetCreator: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            flowBuilder: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            scriptWriter: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            securityAgent: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            testAgent: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    memory: z.ZodDefault<z.ZodObject<{
        dbPath: z.ZodOptional<z.ZodString>;
        schema: z.ZodDefault<z.ZodObject<{
            version: z.ZodDefault<z.ZodString>;
            autoMigrate: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        cache: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            maxSize: z.ZodDefault<z.ZodNumber>;
            ttl: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        ttl: z.ZodDefault<z.ZodObject<{
            default: z.ZodDefault<z.ZodNumber>;
            session: z.ZodDefault<z.ZodNumber>;
            artifact: z.ZodDefault<z.ZodNumber>;
            metric: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        cleanup: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            interval: z.ZodDefault<z.ZodNumber>;
            retentionDays: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    mcp: z.ZodDefault<z.ZodObject<{
        servers: z.ZodDefault<z.ZodObject<{
            deployment: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            intelligent: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            operations: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            flowComposer: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            platformDevelopment: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        transport: z.ZodDefault<z.ZodObject<{
            type: z.ZodDefault<z.ZodEnum<{
                stdio: "stdio";
                http: "http";
                websocket: "websocket";
            }>>;
            timeout: z.ZodDefault<z.ZodNumber>;
            retryAttempts: z.ZodDefault<z.ZodNumber>;
            retryDelay: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        authentication: z.ZodDefault<z.ZodObject<{
            required: z.ZodDefault<z.ZodBoolean>;
            tokenExpiry: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    servicenow: z.ZodDefault<z.ZodObject<{
        instance: z.ZodOptional<z.ZodString>;
        clientId: z.ZodOptional<z.ZodString>;
        clientSecret: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        authType: z.ZodDefault<z.ZodEnum<{
            oauth: "oauth";
            basic: "basic";
        }>>;
        apiVersion: z.ZodDefault<z.ZodString>;
        timeout: z.ZodDefault<z.ZodNumber>;
        retryConfig: z.ZodDefault<z.ZodObject<{
            maxRetries: z.ZodDefault<z.ZodNumber>;
            retryDelay: z.ZodDefault<z.ZodNumber>;
            backoffMultiplier: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        cache: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            ttl: z.ZodDefault<z.ZodNumber>;
            maxSize: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        oauth: z.ZodDefault<z.ZodObject<{
            redirectHost: z.ZodDefault<z.ZodString>;
            redirectPort: z.ZodDefault<z.ZodNumber>;
            redirectPath: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    monitoring: z.ZodDefault<z.ZodObject<{
        performance: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            sampleRate: z.ZodDefault<z.ZodNumber>;
            metricsRetention: z.ZodDefault<z.ZodNumber>;
            aggregationInterval: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        health: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            checkInterval: z.ZodDefault<z.ZodNumber>;
            endpoints: z.ZodDefault<z.ZodArray<z.ZodString>>;
            thresholds: z.ZodDefault<z.ZodObject<{
                memoryUsage: z.ZodDefault<z.ZodNumber>;
                cpuUsage: z.ZodDefault<z.ZodNumber>;
                errorRate: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        alerts: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            channels: z.ZodDefault<z.ZodArray<z.ZodEnum<{
                file: "file";
                console: "console";
                webhook: "webhook";
            }>>>;
            webhookUrl: z.ZodOptional<z.ZodString>;
            severityThreshold: z.ZodDefault<z.ZodEnum<{
                info: "info";
                warn: "warn";
                error: "error";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    health: z.ZodDefault<z.ZodObject<{
        checks: z.ZodDefault<z.ZodObject<{
            memory: z.ZodDefault<z.ZodBoolean>;
            mcp: z.ZodDefault<z.ZodBoolean>;
            servicenow: z.ZodDefault<z.ZodBoolean>;
            queen: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        thresholds: z.ZodDefault<z.ZodObject<{
            responseTime: z.ZodDefault<z.ZodNumber>;
            memoryUsage: z.ZodDefault<z.ZodNumber>;
            queueSize: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    features: z.ZodDefault<z.ZodObject<{
        autoPermissions: z.ZodDefault<z.ZodBoolean>;
        smartDiscovery: z.ZodDefault<z.ZodBoolean>;
        liveTesting: z.ZodDefault<z.ZodBoolean>;
        autoDeploy: z.ZodDefault<z.ZodBoolean>;
        autoRollback: z.ZodDefault<z.ZodBoolean>;
        sharedMemory: z.ZodDefault<z.ZodBoolean>;
        progressMonitoring: z.ZodDefault<z.ZodBoolean>;
        neuralPatterns: z.ZodDefault<z.ZodBoolean>;
        cognitiveAnalysis: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ISnowFlowConfig = z.infer<typeof ConfigSchema>;
export declare class SnowFlowConfig {
    private config;
    private configPath;
    constructor(overrides?: Partial<ISnowFlowConfig>);
    /**
     * Get the current configuration
     */
    get(): ISnowFlowConfig;
    /**
     * Update configuration
     */
    update(updates: Partial<ISnowFlowConfig>): void;
    /**
     * Get a specific configuration value
     */
    getValue(path: string): any;
    /**
     * Set a specific configuration value
     */
    setValue(path: string, value: any): void;
    /**
     * Save configuration to file
     */
    saveToFile(): void;
    /**
     * Load configuration from file
     */
    private loadFromFile;
    /**
     * Load configuration from environment variables
     */
    private loadFromEnvironment;
    /**
     * Get default configuration
     */
    private getDefaults;
    /**
     * Merge multiple configuration objects
     */
    private mergeConfigs;
    /**
     * Deep merge objects
     */
    private deepMerge;
    /**
     * Ensure required directories exist
     */
    private ensureDirectories;
    get system(): {
        environment: "development" | "staging" | "production";
        logLevel: "debug" | "info" | "warn" | "error";
        dataDir: string;
        maxConcurrentOperations: number;
        sessionTimeout: number;
    };
    get agents(): {
        queen: {
            maxWorkerAgents: number;
            spawnTimeout: number;
            coordinationInterval: number;
            decisionThreshold: number;
            retryAttempts: number;
        };
        worker: {
            heartbeatInterval: number;
            taskTimeout: number;
            maxMemoryUsage: number;
            autoShutdownIdle: number;
        };
        specializations: {
            widgetCreator: {
                enabled: boolean;
                priority: number;
                capabilities: string[];
            };
            flowBuilder: {
                enabled: boolean;
                priority: number;
                capabilities: string[];
            };
            scriptWriter: {
                enabled: boolean;
                priority: number;
                capabilities: string[];
            };
            securityAgent: {
                enabled: boolean;
                priority: number;
                capabilities: string[];
            };
            testAgent: {
                enabled: boolean;
                priority: number;
                capabilities: string[];
            };
        };
    };
    get memory(): {
        schema: {
            version: string;
            autoMigrate: boolean;
        };
        cache: {
            enabled: boolean;
            maxSize: number;
            ttl: number;
        };
        ttl: {
            default: number;
            session: number;
            artifact: number;
            metric: number;
        };
        cleanup: {
            enabled: boolean;
            interval: number;
            retentionDays: number;
        };
        dbPath?: string;
    };
    get mcp(): {
        servers: {
            deployment: {
                enabled: boolean;
                port: number;
                host: string;
            };
            intelligent: {
                enabled: boolean;
                port: number;
                host: string;
            };
            operations: {
                enabled: boolean;
                port: number;
                host: string;
            };
            flowComposer: {
                enabled: boolean;
                port: number;
                host: string;
            };
            platformDevelopment: {
                enabled: boolean;
                port: number;
                host: string;
            };
        };
        transport: {
            type: "stdio" | "http" | "websocket";
            timeout: number;
            retryAttempts: number;
            retryDelay: number;
        };
        authentication: {
            required: boolean;
            tokenExpiry: number;
        };
    };
    get servicenow(): {
        authType: "oauth" | "basic";
        apiVersion: string;
        timeout: number;
        retryConfig: {
            maxRetries: number;
            retryDelay: number;
            backoffMultiplier: number;
        };
        cache: {
            enabled: boolean;
            ttl: number;
            maxSize: number;
        };
        oauth: {
            redirectHost: string;
            redirectPort: number;
            redirectPath: string;
        };
        instance?: string;
        clientId?: string;
        clientSecret?: string;
        username?: string;
        password?: string;
    };
    get monitoring(): {
        performance: {
            enabled: boolean;
            sampleRate: number;
            metricsRetention: number;
            aggregationInterval: number;
        };
        health: {
            enabled: boolean;
            checkInterval: number;
            endpoints: string[];
            thresholds: {
                memoryUsage: number;
                cpuUsage: number;
                errorRate: number;
            };
        };
        alerts: {
            enabled: boolean;
            channels: ("file" | "console" | "webhook")[];
            severityThreshold: "info" | "warn" | "error";
            webhookUrl?: string;
        };
    };
    get health(): {
        checks: {
            memory: boolean;
            mcp: boolean;
            servicenow: boolean;
            queen: boolean;
        };
        thresholds: {
            responseTime: number;
            memoryUsage: number;
            queueSize: number;
        };
    };
    get features(): {
        autoPermissions: boolean;
        smartDiscovery: boolean;
        liveTesting: boolean;
        autoDeploy: boolean;
        autoRollback: boolean;
        sharedMemory: boolean;
        progressMonitoring: boolean;
        neuralPatterns: boolean;
        cognitiveAnalysis: boolean;
    };
}
export declare const snowFlowConfig: SnowFlowConfig;
export {};
//# sourceMappingURL=snow-flow-config.d.ts.map