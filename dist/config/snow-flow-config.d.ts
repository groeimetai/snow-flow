/**
 * Snow-Flow Configuration Management
 * Central configuration for all system components
 */
import { z } from 'zod';
declare const ConfigSchema: z.ZodObject<{
    system: z.ZodDefault<z.ZodObject<{
        environment: z.ZodDefault<z.ZodEnum<["development", "staging", "production"]>>;
        logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
        dataDir: z.ZodDefault<z.ZodString>;
        maxConcurrentOperations: z.ZodDefault<z.ZodNumber>;
        sessionTimeout: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        environment?: "development" | "staging" | "production";
        logLevel?: "debug" | "info" | "warn" | "error";
        dataDir?: string;
        maxConcurrentOperations?: number;
        sessionTimeout?: number;
    }, {
        environment?: "development" | "staging" | "production";
        logLevel?: "debug" | "info" | "warn" | "error";
        dataDir?: string;
        maxConcurrentOperations?: number;
        sessionTimeout?: number;
    }>>;
    agents: z.ZodDefault<z.ZodObject<{
        queen: z.ZodDefault<z.ZodObject<{
            maxWorkerAgents: z.ZodDefault<z.ZodNumber>;
            spawnTimeout: z.ZodDefault<z.ZodNumber>;
            coordinationInterval: z.ZodDefault<z.ZodNumber>;
            decisionThreshold: z.ZodDefault<z.ZodNumber>;
            retryAttempts: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            maxWorkerAgents?: number;
            spawnTimeout?: number;
            coordinationInterval?: number;
            decisionThreshold?: number;
            retryAttempts?: number;
        }, {
            maxWorkerAgents?: number;
            spawnTimeout?: number;
            coordinationInterval?: number;
            decisionThreshold?: number;
            retryAttempts?: number;
        }>>;
        worker: z.ZodDefault<z.ZodObject<{
            heartbeatInterval: z.ZodDefault<z.ZodNumber>;
            taskTimeout: z.ZodDefault<z.ZodNumber>;
            maxMemoryUsage: z.ZodDefault<z.ZodNumber>;
            autoShutdownIdle: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            heartbeatInterval?: number;
            taskTimeout?: number;
            maxMemoryUsage?: number;
            autoShutdownIdle?: number;
        }, {
            heartbeatInterval?: number;
            taskTimeout?: number;
            maxMemoryUsage?: number;
            autoShutdownIdle?: number;
        }>>;
        specializations: z.ZodDefault<z.ZodObject<{
            widgetCreator: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }>>;
            flowBuilder: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }>>;
            scriptWriter: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }>>;
            securityAgent: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }>>;
            testAgent: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                priority: z.ZodDefault<z.ZodNumber>;
                capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }, {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            }>>;
        }, "strip", z.ZodTypeAny, {
            widgetCreator?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            flowBuilder?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            scriptWriter?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            securityAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            testAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
        }, {
            widgetCreator?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            flowBuilder?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            scriptWriter?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            securityAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            testAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
        }>>;
    }, "strip", z.ZodTypeAny, {
        queen?: {
            maxWorkerAgents?: number;
            spawnTimeout?: number;
            coordinationInterval?: number;
            decisionThreshold?: number;
            retryAttempts?: number;
        };
        worker?: {
            heartbeatInterval?: number;
            taskTimeout?: number;
            maxMemoryUsage?: number;
            autoShutdownIdle?: number;
        };
        specializations?: {
            widgetCreator?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            flowBuilder?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            scriptWriter?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            securityAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            testAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
        };
    }, {
        queen?: {
            maxWorkerAgents?: number;
            spawnTimeout?: number;
            coordinationInterval?: number;
            decisionThreshold?: number;
            retryAttempts?: number;
        };
        worker?: {
            heartbeatInterval?: number;
            taskTimeout?: number;
            maxMemoryUsage?: number;
            autoShutdownIdle?: number;
        };
        specializations?: {
            widgetCreator?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            flowBuilder?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            scriptWriter?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            securityAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            testAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
        };
    }>>;
    memory: z.ZodDefault<z.ZodObject<{
        dbPath: z.ZodOptional<z.ZodString>;
        schema: z.ZodDefault<z.ZodObject<{
            version: z.ZodDefault<z.ZodString>;
            autoMigrate: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            version?: string;
            autoMigrate?: boolean;
        }, {
            version?: string;
            autoMigrate?: boolean;
        }>>;
        cache: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            maxSize: z.ZodDefault<z.ZodNumber>;
            ttl: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        }, {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        }>>;
        ttl: z.ZodDefault<z.ZodObject<{
            default: z.ZodDefault<z.ZodNumber>;
            session: z.ZodDefault<z.ZodNumber>;
            artifact: z.ZodDefault<z.ZodNumber>;
            metric: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            default?: number;
            session?: number;
            artifact?: number;
            metric?: number;
        }, {
            default?: number;
            session?: number;
            artifact?: number;
            metric?: number;
        }>>;
        cleanup: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            interval: z.ZodDefault<z.ZodNumber>;
            retentionDays: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean;
            interval?: number;
            retentionDays?: number;
        }, {
            enabled?: boolean;
            interval?: number;
            retentionDays?: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        dbPath?: string;
        schema?: {
            version?: string;
            autoMigrate?: boolean;
        };
        ttl?: {
            default?: number;
            session?: number;
            artifact?: number;
            metric?: number;
        };
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        cleanup?: {
            enabled?: boolean;
            interval?: number;
            retentionDays?: number;
        };
    }, {
        dbPath?: string;
        schema?: {
            version?: string;
            autoMigrate?: boolean;
        };
        ttl?: {
            default?: number;
            session?: number;
            artifact?: number;
            metric?: number;
        };
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        cleanup?: {
            enabled?: boolean;
            interval?: number;
            retentionDays?: number;
        };
    }>>;
    mcp: z.ZodDefault<z.ZodObject<{
        servers: z.ZodDefault<z.ZodObject<{
            deployment: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }>>;
            intelligent: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }>>;
            operations: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }>>;
            flowComposer: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }>>;
            platformDevelopment: z.ZodDefault<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                host: z.ZodDefault<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }, {
                enabled?: boolean;
                port?: number;
                host?: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            deployment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            intelligent?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            operations?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            flowComposer?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            platformDevelopment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
        }, {
            deployment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            intelligent?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            operations?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            flowComposer?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            platformDevelopment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
        }>>;
        transport: z.ZodDefault<z.ZodObject<{
            type: z.ZodDefault<z.ZodEnum<["stdio", "http", "websocket"]>>;
            timeout: z.ZodDefault<z.ZodNumber>;
            retryAttempts: z.ZodDefault<z.ZodNumber>;
            retryDelay: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            type?: "stdio" | "http" | "websocket";
            retryAttempts?: number;
            timeout?: number;
            retryDelay?: number;
        }, {
            type?: "stdio" | "http" | "websocket";
            retryAttempts?: number;
            timeout?: number;
            retryDelay?: number;
        }>>;
        authentication: z.ZodDefault<z.ZodObject<{
            required: z.ZodDefault<z.ZodBoolean>;
            tokenExpiry: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            required?: boolean;
            tokenExpiry?: number;
        }, {
            required?: boolean;
            tokenExpiry?: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        servers?: {
            deployment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            intelligent?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            operations?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            flowComposer?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            platformDevelopment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
        };
        transport?: {
            type?: "stdio" | "http" | "websocket";
            retryAttempts?: number;
            timeout?: number;
            retryDelay?: number;
        };
        authentication?: {
            required?: boolean;
            tokenExpiry?: number;
        };
    }, {
        servers?: {
            deployment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            intelligent?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            operations?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            flowComposer?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            platformDevelopment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
        };
        transport?: {
            type?: "stdio" | "http" | "websocket";
            retryAttempts?: number;
            timeout?: number;
            retryDelay?: number;
        };
        authentication?: {
            required?: boolean;
            tokenExpiry?: number;
        };
    }>>;
    servicenow: z.ZodDefault<z.ZodObject<{
        instance: z.ZodOptional<z.ZodString>;
        clientId: z.ZodOptional<z.ZodString>;
        clientSecret: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        authType: z.ZodDefault<z.ZodEnum<["oauth", "basic"]>>;
        apiVersion: z.ZodDefault<z.ZodString>;
        timeout: z.ZodDefault<z.ZodNumber>;
        retryConfig: z.ZodDefault<z.ZodObject<{
            maxRetries: z.ZodDefault<z.ZodNumber>;
            retryDelay: z.ZodDefault<z.ZodNumber>;
            backoffMultiplier: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            retryDelay?: number;
            maxRetries?: number;
            backoffMultiplier?: number;
        }, {
            retryDelay?: number;
            maxRetries?: number;
            backoffMultiplier?: number;
        }>>;
        cache: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            ttl: z.ZodDefault<z.ZodNumber>;
            maxSize: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        }, {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        }>>;
        oauth: z.ZodDefault<z.ZodObject<{
            redirectHost: z.ZodDefault<z.ZodString>;
            redirectPort: z.ZodDefault<z.ZodNumber>;
            redirectPath: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            redirectHost?: string;
            redirectPort?: number;
            redirectPath?: string;
        }, {
            redirectHost?: string;
            redirectPort?: number;
            redirectPath?: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        timeout?: number;
        instance?: string;
        clientId?: string;
        clientSecret?: string;
        username?: string;
        password?: string;
        oauth?: {
            redirectHost?: string;
            redirectPort?: number;
            redirectPath?: string;
        };
        authType?: "oauth" | "basic";
        apiVersion?: string;
        retryConfig?: {
            retryDelay?: number;
            maxRetries?: number;
            backoffMultiplier?: number;
        };
    }, {
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        timeout?: number;
        instance?: string;
        clientId?: string;
        clientSecret?: string;
        username?: string;
        password?: string;
        oauth?: {
            redirectHost?: string;
            redirectPort?: number;
            redirectPath?: string;
        };
        authType?: "oauth" | "basic";
        apiVersion?: string;
        retryConfig?: {
            retryDelay?: number;
            maxRetries?: number;
            backoffMultiplier?: number;
        };
    }>>;
    monitoring: z.ZodDefault<z.ZodObject<{
        performance: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            sampleRate: z.ZodDefault<z.ZodNumber>;
            metricsRetention: z.ZodDefault<z.ZodNumber>;
            aggregationInterval: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean;
            sampleRate?: number;
            metricsRetention?: number;
            aggregationInterval?: number;
        }, {
            enabled?: boolean;
            sampleRate?: number;
            metricsRetention?: number;
            aggregationInterval?: number;
        }>>;
        health: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            checkInterval: z.ZodDefault<z.ZodNumber>;
            endpoints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            thresholds: z.ZodDefault<z.ZodObject<{
                memoryUsage: z.ZodDefault<z.ZodNumber>;
                cpuUsage: z.ZodDefault<z.ZodNumber>;
                errorRate: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            }, {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean;
            checkInterval?: number;
            endpoints?: string[];
            thresholds?: {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            };
        }, {
            enabled?: boolean;
            checkInterval?: number;
            endpoints?: string[];
            thresholds?: {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            };
        }>>;
        alerts: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            channels: z.ZodDefault<z.ZodArray<z.ZodEnum<["console", "file", "webhook"]>, "many">>;
            webhookUrl: z.ZodOptional<z.ZodString>;
            severityThreshold: z.ZodDefault<z.ZodEnum<["info", "warn", "error"]>>;
        }, "strip", z.ZodTypeAny, {
            enabled?: boolean;
            channels?: ("console" | "file" | "webhook")[];
            webhookUrl?: string;
            severityThreshold?: "info" | "warn" | "error";
        }, {
            enabled?: boolean;
            channels?: ("console" | "file" | "webhook")[];
            webhookUrl?: string;
            severityThreshold?: "info" | "warn" | "error";
        }>>;
    }, "strip", z.ZodTypeAny, {
        performance?: {
            enabled?: boolean;
            sampleRate?: number;
            metricsRetention?: number;
            aggregationInterval?: number;
        };
        health?: {
            enabled?: boolean;
            checkInterval?: number;
            endpoints?: string[];
            thresholds?: {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            };
        };
        alerts?: {
            enabled?: boolean;
            channels?: ("console" | "file" | "webhook")[];
            webhookUrl?: string;
            severityThreshold?: "info" | "warn" | "error";
        };
    }, {
        performance?: {
            enabled?: boolean;
            sampleRate?: number;
            metricsRetention?: number;
            aggregationInterval?: number;
        };
        health?: {
            enabled?: boolean;
            checkInterval?: number;
            endpoints?: string[];
            thresholds?: {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            };
        };
        alerts?: {
            enabled?: boolean;
            channels?: ("console" | "file" | "webhook")[];
            webhookUrl?: string;
            severityThreshold?: "info" | "warn" | "error";
        };
    }>>;
    health: z.ZodDefault<z.ZodObject<{
        checks: z.ZodDefault<z.ZodObject<{
            memory: z.ZodDefault<z.ZodBoolean>;
            mcp: z.ZodDefault<z.ZodBoolean>;
            servicenow: z.ZodDefault<z.ZodBoolean>;
            queen: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            queen?: boolean;
            memory?: boolean;
            mcp?: boolean;
            servicenow?: boolean;
        }, {
            queen?: boolean;
            memory?: boolean;
            mcp?: boolean;
            servicenow?: boolean;
        }>>;
        thresholds: z.ZodDefault<z.ZodObject<{
            responseTime: z.ZodDefault<z.ZodNumber>;
            memoryUsage: z.ZodDefault<z.ZodNumber>;
            queueSize: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            memoryUsage?: number;
            responseTime?: number;
            queueSize?: number;
        }, {
            memoryUsage?: number;
            responseTime?: number;
            queueSize?: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        thresholds?: {
            memoryUsage?: number;
            responseTime?: number;
            queueSize?: number;
        };
        checks?: {
            queen?: boolean;
            memory?: boolean;
            mcp?: boolean;
            servicenow?: boolean;
        };
    }, {
        thresholds?: {
            memoryUsage?: number;
            responseTime?: number;
            queueSize?: number;
        };
        checks?: {
            queen?: boolean;
            memory?: boolean;
            mcp?: boolean;
            servicenow?: boolean;
        };
    }>>;
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
    }, "strip", z.ZodTypeAny, {
        autoPermissions?: boolean;
        smartDiscovery?: boolean;
        liveTesting?: boolean;
        autoDeploy?: boolean;
        autoRollback?: boolean;
        sharedMemory?: boolean;
        progressMonitoring?: boolean;
        neuralPatterns?: boolean;
        cognitiveAnalysis?: boolean;
    }, {
        autoPermissions?: boolean;
        smartDiscovery?: boolean;
        liveTesting?: boolean;
        autoDeploy?: boolean;
        autoRollback?: boolean;
        sharedMemory?: boolean;
        progressMonitoring?: boolean;
        neuralPatterns?: boolean;
        cognitiveAnalysis?: boolean;
    }>>;
}, "strip", z.ZodTypeAny, {
    system?: {
        environment?: "development" | "staging" | "production";
        logLevel?: "debug" | "info" | "warn" | "error";
        dataDir?: string;
        maxConcurrentOperations?: number;
        sessionTimeout?: number;
    };
    agents?: {
        queen?: {
            maxWorkerAgents?: number;
            spawnTimeout?: number;
            coordinationInterval?: number;
            decisionThreshold?: number;
            retryAttempts?: number;
        };
        worker?: {
            heartbeatInterval?: number;
            taskTimeout?: number;
            maxMemoryUsage?: number;
            autoShutdownIdle?: number;
        };
        specializations?: {
            widgetCreator?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            flowBuilder?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            scriptWriter?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            securityAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            testAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
        };
    };
    memory?: {
        dbPath?: string;
        schema?: {
            version?: string;
            autoMigrate?: boolean;
        };
        ttl?: {
            default?: number;
            session?: number;
            artifact?: number;
            metric?: number;
        };
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        cleanup?: {
            enabled?: boolean;
            interval?: number;
            retentionDays?: number;
        };
    };
    mcp?: {
        servers?: {
            deployment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            intelligent?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            operations?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            flowComposer?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            platformDevelopment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
        };
        transport?: {
            type?: "stdio" | "http" | "websocket";
            retryAttempts?: number;
            timeout?: number;
            retryDelay?: number;
        };
        authentication?: {
            required?: boolean;
            tokenExpiry?: number;
        };
    };
    servicenow?: {
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        timeout?: number;
        instance?: string;
        clientId?: string;
        clientSecret?: string;
        username?: string;
        password?: string;
        oauth?: {
            redirectHost?: string;
            redirectPort?: number;
            redirectPath?: string;
        };
        authType?: "oauth" | "basic";
        apiVersion?: string;
        retryConfig?: {
            retryDelay?: number;
            maxRetries?: number;
            backoffMultiplier?: number;
        };
    };
    health?: {
        thresholds?: {
            memoryUsage?: number;
            responseTime?: number;
            queueSize?: number;
        };
        checks?: {
            queen?: boolean;
            memory?: boolean;
            mcp?: boolean;
            servicenow?: boolean;
        };
    };
    monitoring?: {
        performance?: {
            enabled?: boolean;
            sampleRate?: number;
            metricsRetention?: number;
            aggregationInterval?: number;
        };
        health?: {
            enabled?: boolean;
            checkInterval?: number;
            endpoints?: string[];
            thresholds?: {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            };
        };
        alerts?: {
            enabled?: boolean;
            channels?: ("console" | "file" | "webhook")[];
            webhookUrl?: string;
            severityThreshold?: "info" | "warn" | "error";
        };
    };
    features?: {
        autoPermissions?: boolean;
        smartDiscovery?: boolean;
        liveTesting?: boolean;
        autoDeploy?: boolean;
        autoRollback?: boolean;
        sharedMemory?: boolean;
        progressMonitoring?: boolean;
        neuralPatterns?: boolean;
        cognitiveAnalysis?: boolean;
    };
}, {
    system?: {
        environment?: "development" | "staging" | "production";
        logLevel?: "debug" | "info" | "warn" | "error";
        dataDir?: string;
        maxConcurrentOperations?: number;
        sessionTimeout?: number;
    };
    agents?: {
        queen?: {
            maxWorkerAgents?: number;
            spawnTimeout?: number;
            coordinationInterval?: number;
            decisionThreshold?: number;
            retryAttempts?: number;
        };
        worker?: {
            heartbeatInterval?: number;
            taskTimeout?: number;
            maxMemoryUsage?: number;
            autoShutdownIdle?: number;
        };
        specializations?: {
            widgetCreator?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            flowBuilder?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            scriptWriter?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            securityAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            testAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
        };
    };
    memory?: {
        dbPath?: string;
        schema?: {
            version?: string;
            autoMigrate?: boolean;
        };
        ttl?: {
            default?: number;
            session?: number;
            artifact?: number;
            metric?: number;
        };
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        cleanup?: {
            enabled?: boolean;
            interval?: number;
            retentionDays?: number;
        };
    };
    mcp?: {
        servers?: {
            deployment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            intelligent?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            operations?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            flowComposer?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            platformDevelopment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
        };
        transport?: {
            type?: "stdio" | "http" | "websocket";
            retryAttempts?: number;
            timeout?: number;
            retryDelay?: number;
        };
        authentication?: {
            required?: boolean;
            tokenExpiry?: number;
        };
    };
    servicenow?: {
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        timeout?: number;
        instance?: string;
        clientId?: string;
        clientSecret?: string;
        username?: string;
        password?: string;
        oauth?: {
            redirectHost?: string;
            redirectPort?: number;
            redirectPath?: string;
        };
        authType?: "oauth" | "basic";
        apiVersion?: string;
        retryConfig?: {
            retryDelay?: number;
            maxRetries?: number;
            backoffMultiplier?: number;
        };
    };
    health?: {
        thresholds?: {
            memoryUsage?: number;
            responseTime?: number;
            queueSize?: number;
        };
        checks?: {
            queen?: boolean;
            memory?: boolean;
            mcp?: boolean;
            servicenow?: boolean;
        };
    };
    monitoring?: {
        performance?: {
            enabled?: boolean;
            sampleRate?: number;
            metricsRetention?: number;
            aggregationInterval?: number;
        };
        health?: {
            enabled?: boolean;
            checkInterval?: number;
            endpoints?: string[];
            thresholds?: {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            };
        };
        alerts?: {
            enabled?: boolean;
            channels?: ("console" | "file" | "webhook")[];
            webhookUrl?: string;
            severityThreshold?: "info" | "warn" | "error";
        };
    };
    features?: {
        autoPermissions?: boolean;
        smartDiscovery?: boolean;
        liveTesting?: boolean;
        autoDeploy?: boolean;
        autoRollback?: boolean;
        sharedMemory?: boolean;
        progressMonitoring?: boolean;
        neuralPatterns?: boolean;
        cognitiveAnalysis?: boolean;
    };
}>;
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
        environment?: "development" | "staging" | "production";
        logLevel?: "debug" | "info" | "warn" | "error";
        dataDir?: string;
        maxConcurrentOperations?: number;
        sessionTimeout?: number;
    };
    get agents(): {
        queen?: {
            maxWorkerAgents?: number;
            spawnTimeout?: number;
            coordinationInterval?: number;
            decisionThreshold?: number;
            retryAttempts?: number;
        };
        worker?: {
            heartbeatInterval?: number;
            taskTimeout?: number;
            maxMemoryUsage?: number;
            autoShutdownIdle?: number;
        };
        specializations?: {
            widgetCreator?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            flowBuilder?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            scriptWriter?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            securityAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
            testAgent?: {
                enabled?: boolean;
                priority?: number;
                capabilities?: string[];
            };
        };
    };
    get memory(): {
        dbPath?: string;
        schema?: {
            version?: string;
            autoMigrate?: boolean;
        };
        ttl?: {
            default?: number;
            session?: number;
            artifact?: number;
            metric?: number;
        };
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        cleanup?: {
            enabled?: boolean;
            interval?: number;
            retentionDays?: number;
        };
    };
    get mcp(): {
        servers?: {
            deployment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            intelligent?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            operations?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            flowComposer?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
            platformDevelopment?: {
                enabled?: boolean;
                port?: number;
                host?: string;
            };
        };
        transport?: {
            type?: "stdio" | "http" | "websocket";
            retryAttempts?: number;
            timeout?: number;
            retryDelay?: number;
        };
        authentication?: {
            required?: boolean;
            tokenExpiry?: number;
        };
    };
    get servicenow(): {
        cache?: {
            enabled?: boolean;
            maxSize?: number;
            ttl?: number;
        };
        timeout?: number;
        instance?: string;
        clientId?: string;
        clientSecret?: string;
        username?: string;
        password?: string;
        oauth?: {
            redirectHost?: string;
            redirectPort?: number;
            redirectPath?: string;
        };
        authType?: "oauth" | "basic";
        apiVersion?: string;
        retryConfig?: {
            retryDelay?: number;
            maxRetries?: number;
            backoffMultiplier?: number;
        };
    };
    get monitoring(): {
        performance?: {
            enabled?: boolean;
            sampleRate?: number;
            metricsRetention?: number;
            aggregationInterval?: number;
        };
        health?: {
            enabled?: boolean;
            checkInterval?: number;
            endpoints?: string[];
            thresholds?: {
                memoryUsage?: number;
                cpuUsage?: number;
                errorRate?: number;
            };
        };
        alerts?: {
            enabled?: boolean;
            channels?: ("console" | "file" | "webhook")[];
            webhookUrl?: string;
            severityThreshold?: "info" | "warn" | "error";
        };
    };
    get health(): {
        thresholds?: {
            memoryUsage?: number;
            responseTime?: number;
            queueSize?: number;
        };
        checks?: {
            queen?: boolean;
            memory?: boolean;
            mcp?: boolean;
            servicenow?: boolean;
        };
    };
    get features(): {
        autoPermissions?: boolean;
        smartDiscovery?: boolean;
        liveTesting?: boolean;
        autoDeploy?: boolean;
        autoRollback?: boolean;
        sharedMemory?: boolean;
        progressMonitoring?: boolean;
        neuralPatterns?: boolean;
        cognitiveAnalysis?: boolean;
    };
}
export declare const snowFlowConfig: SnowFlowConfig;
export {};
//# sourceMappingURL=snow-flow-config.d.ts.map