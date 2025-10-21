"use strict";
/**
 * Snow-Flow Configuration Management
 * Central configuration for all system components
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.snowFlowConfig = exports.SnowFlowConfig = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
// Configuration Schema using Zod for validation
const ConfigSchema = zod_1.z.object({
    // System-wide settings
    system: zod_1.z
        .object({
        environment: zod_1.z.enum(['development', 'staging', 'production']).default('development'),
        logLevel: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        dataDir: zod_1.z
            .string()
            .default(process.env.SNOW_FLOW_HOME || path_1.default.join(os_1.default.homedir(), '.snow-flow')),
        maxConcurrentOperations: zod_1.z.number().min(1).max(100).default(10),
        sessionTimeout: zod_1.z.number().min(300000).default(3600000), // 1 hour default
    })
        .default({
        environment: 'development',
        logLevel: 'info',
        dataDir: process.env.SNOW_FLOW_HOME || path_1.default.join(os_1.default.homedir(), '.snow-flow'),
        maxConcurrentOperations: 10,
        sessionTimeout: 3600000,
    }),
    // Agent configuration
    agents: zod_1.z
        .object({
        queen: zod_1.z
            .object({
            maxWorkerAgents: zod_1.z.number().min(1).max(50).default(10),
            spawnTimeout: zod_1.z.number().min(5000).default(30000),
            coordinationInterval: zod_1.z.number().min(1000).default(5000),
            decisionThreshold: zod_1.z.number().min(0).max(1).default(0.7),
            retryAttempts: zod_1.z.number().min(1).max(10).default(3),
        })
            .default({
            maxWorkerAgents: 10,
            spawnTimeout: 30000,
            coordinationInterval: 5000,
            decisionThreshold: 0.7,
            retryAttempts: 3,
        }),
        worker: zod_1.z
            .object({
            heartbeatInterval: zod_1.z.number().min(1000).default(10000),
            taskTimeout: zod_1.z.number().min(60000).default(300000), // 5 minutes
            maxMemoryUsage: zod_1.z.number().min(100).default(500), // MB
            autoShutdownIdle: zod_1.z.number().min(60000).default(600000), // 10 minutes
        })
            .default({
            heartbeatInterval: 10000,
            taskTimeout: 300000,
            maxMemoryUsage: 500,
            autoShutdownIdle: 600000,
        }),
        specializations: zod_1.z
            .object({
            widgetCreator: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                priority: zod_1.z.number().min(1).max(10).default(8),
                capabilities: zod_1.z
                    .array(zod_1.z.string())
                    .default(['html', 'css', 'javascript', 'servicenow-api']),
            })
                .default({
                enabled: true,
                priority: 8,
                capabilities: ['html', 'css', 'javascript', 'servicenow-api'],
            }),
            flowBuilder: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                priority: zod_1.z.number().min(1).max(10).default(8),
                capabilities: zod_1.z
                    .array(zod_1.z.string())
                    .default(['flow-designer', 'triggers', 'actions', 'approvals']),
            })
                .default({
                enabled: true,
                priority: 8,
                capabilities: ['flow-designer', 'triggers', 'actions', 'approvals'],
            }),
            scriptWriter: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                priority: zod_1.z.number().min(1).max(10).default(7),
                capabilities: zod_1.z
                    .array(zod_1.z.string())
                    .default(['business-rules', 'script-includes', 'client-scripts']),
            })
                .default({
                enabled: true,
                priority: 7,
                capabilities: ['business-rules', 'script-includes', 'client-scripts'],
            }),
            securityAgent: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                priority: zod_1.z.number().min(1).max(10).default(9),
                capabilities: zod_1.z.array(zod_1.z.string()).default(['acl', 'security-scan', 'compliance']),
            })
                .default({
                enabled: true,
                priority: 9,
                capabilities: ['acl', 'security-scan', 'compliance'],
            }),
            testAgent: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                priority: zod_1.z.number().min(1).max(10).default(6),
                capabilities: zod_1.z
                    .array(zod_1.z.string())
                    .default(['unit-test', 'integration-test', 'performance-test']),
            })
                .default({
                enabled: true,
                priority: 6,
                capabilities: ['unit-test', 'integration-test', 'performance-test'],
            }),
        })
            .default({
            widgetCreator: {
                enabled: true,
                priority: 8,
                capabilities: ['html', 'css', 'javascript', 'servicenow-api'],
            },
            flowBuilder: {
                enabled: true,
                priority: 8,
                capabilities: ['flow-designer', 'triggers', 'actions', 'approvals'],
            },
            scriptWriter: {
                enabled: true,
                priority: 7,
                capabilities: ['business-rules', 'script-includes', 'client-scripts'],
            },
            securityAgent: {
                enabled: true,
                priority: 9,
                capabilities: ['acl', 'security-scan', 'compliance'],
            },
            testAgent: {
                enabled: true,
                priority: 6,
                capabilities: ['unit-test', 'integration-test', 'performance-test'],
            },
        }),
    })
        .default({
        queen: {
            maxWorkerAgents: 10,
            spawnTimeout: 30000,
            coordinationInterval: 5000,
            decisionThreshold: 0.7,
            retryAttempts: 3,
        },
        worker: {
            heartbeatInterval: 10000,
            taskTimeout: 300000,
            maxMemoryUsage: 500,
            autoShutdownIdle: 600000,
        },
        specializations: {
            widgetCreator: {
                enabled: true,
                priority: 8,
                capabilities: ['html', 'css', 'javascript', 'servicenow-api'],
            },
            flowBuilder: {
                enabled: true,
                priority: 8,
                capabilities: ['flow-designer', 'triggers', 'actions', 'approvals'],
            },
            scriptWriter: {
                enabled: true,
                priority: 7,
                capabilities: ['business-rules', 'script-includes', 'client-scripts'],
            },
            securityAgent: {
                enabled: true,
                priority: 9,
                capabilities: ['acl', 'security-scan', 'compliance'],
            },
            testAgent: {
                enabled: true,
                priority: 6,
                capabilities: ['unit-test', 'integration-test', 'performance-test'],
            },
        },
    }),
    // Memory system configuration
    memory: zod_1.z
        .object({
        dbPath: zod_1.z.string().optional(),
        schema: zod_1.z
            .object({
            version: zod_1.z.string().default('1.0.0'),
            autoMigrate: zod_1.z.boolean().default(true),
        })
            .default({
            version: '1.0.0',
            autoMigrate: true,
        }),
        cache: zod_1.z
            .object({
            enabled: zod_1.z.boolean().default(true),
            maxSize: zod_1.z.number().min(10).default(100), // MB
            ttl: zod_1.z.number().min(60000).default(3600000), // 1 hour
        })
            .default({
            enabled: true,
            maxSize: 100,
            ttl: 3600000,
        }),
        ttl: zod_1.z
            .object({
            default: zod_1.z.number().min(3600000).default(86400000), // 24 hours
            session: zod_1.z.number().min(3600000).default(86400000), // 24 hours
            artifact: zod_1.z.number().min(86400000).default(604800000), // 7 days
            metric: zod_1.z.number().min(86400000).default(2592000000), // 30 days
        })
            .default({
            default: 86400000,
            session: 86400000,
            artifact: 604800000,
            metric: 2592000000,
        }),
        cleanup: zod_1.z
            .object({
            enabled: zod_1.z.boolean().default(true),
            interval: zod_1.z.number().min(3600000).default(86400000), // 24 hours
            retentionDays: zod_1.z.number().min(7).default(30),
        })
            .default({
            enabled: true,
            interval: 86400000,
            retentionDays: 30,
        }),
    })
        .default({
        schema: {
            version: '1.0.0',
            autoMigrate: true,
        },
        cache: {
            enabled: true,
            maxSize: 100,
            ttl: 3600000,
        },
        ttl: {
            default: 86400000,
            session: 86400000,
            artifact: 604800000,
            metric: 2592000000,
        },
        cleanup: {
            enabled: true,
            interval: 86400000,
            retentionDays: 30,
        },
    }),
    // MCP server configuration
    mcp: zod_1.z
        .object({
        servers: zod_1.z
            .object({
            deployment: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                port: zod_1.z.number().min(3000).max(65535).default(3001),
                host: zod_1.z.string().default('localhost'),
            })
                .default({
                enabled: true,
                port: 3001,
                host: 'localhost',
            }),
            intelligent: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                port: zod_1.z.number().min(3000).max(65535).default(3002),
                host: zod_1.z.string().default('localhost'),
            })
                .default({
                enabled: true,
                port: 3002,
                host: 'localhost',
            }),
            operations: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                port: zod_1.z.number().min(3000).max(65535).default(3003),
                host: zod_1.z.string().default('localhost'),
            })
                .default({
                enabled: true,
                port: 3003,
                host: 'localhost',
            }),
            flowComposer: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                port: zod_1.z.number().min(3000).max(65535).default(3004),
                host: zod_1.z.string().default('localhost'),
            })
                .default({
                enabled: true,
                port: 3004,
                host: 'localhost',
            }),
            platformDevelopment: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                port: zod_1.z.number().min(3000).max(65535).default(3005),
                host: zod_1.z.string().default('localhost'),
            })
                .default({
                enabled: true,
                port: 3005,
                host: 'localhost',
            }),
        })
            .default({
            deployment: {
                enabled: true,
                port: 3001,
                host: 'localhost',
            },
            intelligent: {
                enabled: true,
                port: 3002,
                host: 'localhost',
            },
            operations: {
                enabled: true,
                port: 3003,
                host: 'localhost',
            },
            flowComposer: {
                enabled: true,
                port: 3004,
                host: 'localhost',
            },
            platformDevelopment: {
                enabled: true,
                port: 3005,
                host: 'localhost',
            },
        }),
        transport: zod_1.z
            .object({
            type: zod_1.z.enum(['stdio', 'http', 'websocket']).default('stdio'),
            timeout: zod_1.z.number().min(0).default(30000), // Allow 0 to disable timeout, or set via MCP_TIMEOUT env var
            retryAttempts: zod_1.z.number().min(1).max(10).default(3),
            retryDelay: zod_1.z.number().min(1000).default(5000),
        })
            .default({
            type: 'stdio',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 5000,
        }),
        authentication: zod_1.z
            .object({
            required: zod_1.z.boolean().default(true),
            tokenExpiry: zod_1.z.number().min(3600000).default(86400000), // 24 hours
        })
            .default({
            required: true,
            tokenExpiry: 86400000,
        }),
    })
        .default({
        servers: {
            deployment: {
                enabled: true,
                port: 3001,
                host: 'localhost',
            },
            intelligent: {
                enabled: true,
                port: 3002,
                host: 'localhost',
            },
            operations: {
                enabled: true,
                port: 3003,
                host: 'localhost',
            },
            flowComposer: {
                enabled: true,
                port: 3004,
                host: 'localhost',
            },
            platformDevelopment: {
                enabled: true,
                port: 3005,
                host: 'localhost',
            },
        },
        transport: {
            type: 'stdio',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 5000,
        },
        authentication: {
            required: true,
            tokenExpiry: 86400000,
        },
    }),
    // ServiceNow connection settings
    servicenow: zod_1.z
        .object({
        instance: zod_1.z.string().optional(),
        clientId: zod_1.z.string().optional(),
        clientSecret: zod_1.z.string().optional(),
        username: zod_1.z.string().optional(),
        password: zod_1.z.string().optional(),
        authType: zod_1.z.enum(['oauth', 'basic']).default('oauth'),
        apiVersion: zod_1.z.string().default('now'),
        timeout: zod_1.z.number().min(5000).default(120000), // Increased from 60s to 120s
        retryConfig: zod_1.z
            .object({
            maxRetries: zod_1.z.number().min(0).max(10).default(3),
            retryDelay: zod_1.z.number().min(1000).default(2000),
            backoffMultiplier: zod_1.z.number().min(1).max(5).default(2),
        })
            .default({
            maxRetries: 3,
            retryDelay: 2000,
            backoffMultiplier: 2,
        }),
        cache: zod_1.z
            .object({
            enabled: zod_1.z.boolean().default(true),
            ttl: zod_1.z.number().min(60000).default(300000), // 5 minutes
            maxSize: zod_1.z.number().min(10).default(50), // MB
        })
            .default({
            enabled: true,
            ttl: 300000,
            maxSize: 50,
        }),
        oauth: zod_1.z
            .object({
            redirectHost: zod_1.z.string().default('localhost'),
            redirectPort: zod_1.z.number().min(3000).max(65535).default(3005),
            redirectPath: zod_1.z.string().default('/callback'),
        })
            .default({
            redirectHost: 'localhost',
            redirectPort: 3005,
            redirectPath: '/callback',
        }),
    })
        .default({
        authType: 'oauth',
        apiVersion: 'now',
        timeout: 120000,
        retryConfig: {
            maxRetries: 3,
            retryDelay: 2000,
            backoffMultiplier: 2,
        },
        cache: {
            enabled: true,
            ttl: 300000,
            maxSize: 50,
        },
        oauth: {
            redirectHost: 'localhost',
            redirectPort: 3005,
            redirectPath: '/callback',
        },
    }),
    // Monitoring configuration
    monitoring: zod_1.z
        .object({
        performance: zod_1.z
            .object({
            enabled: zod_1.z.boolean().default(true),
            sampleRate: zod_1.z.number().min(0).max(1).default(1),
            metricsRetention: zod_1.z.number().min(86400000).default(604800000), // 7 days
            aggregationInterval: zod_1.z.number().min(60000).default(300000), // 5 minutes
        })
            .default({
            enabled: true,
            sampleRate: 1,
            metricsRetention: 604800000,
            aggregationInterval: 300000,
        }),
        health: zod_1.z
            .object({
            enabled: zod_1.z.boolean().default(true),
            checkInterval: zod_1.z.number().min(30000).default(60000), // 1 minute
            endpoints: zod_1.z.array(zod_1.z.string()).default([]),
            thresholds: zod_1.z
                .object({
                memoryUsage: zod_1.z.number().min(0).max(1).default(0.8), // 80%
                cpuUsage: zod_1.z.number().min(0).max(1).default(0.8), // 80%
                errorRate: zod_1.z.number().min(0).max(1).default(0.05), // 5%
            })
                .default({
                memoryUsage: 0.8,
                cpuUsage: 0.8,
                errorRate: 0.05,
            }),
        })
            .default({
            enabled: true,
            checkInterval: 60000,
            endpoints: [],
            thresholds: {
                memoryUsage: 0.8,
                cpuUsage: 0.8,
                errorRate: 0.05,
            },
        }),
        alerts: zod_1.z
            .object({
            enabled: zod_1.z.boolean().default(true),
            channels: zod_1.z.array(zod_1.z.enum(['console', 'file', 'webhook'])).default(['console']),
            webhookUrl: zod_1.z.string().url().optional(),
            severityThreshold: zod_1.z.enum(['info', 'warn', 'error']).default('warn'),
        })
            .default({
            enabled: true,
            channels: ['console'],
            severityThreshold: 'warn',
        }),
    })
        .default({
        performance: {
            enabled: true,
            sampleRate: 1,
            metricsRetention: 604800000,
            aggregationInterval: 300000,
        },
        health: {
            enabled: true,
            checkInterval: 60000,
            endpoints: [],
            thresholds: {
                memoryUsage: 0.8,
                cpuUsage: 0.8,
                errorRate: 0.05,
            },
        },
        alerts: {
            enabled: true,
            channels: ['console'],
            severityThreshold: 'warn',
        },
    }),
    // Health check configuration
    health: zod_1.z
        .object({
        checks: zod_1.z
            .object({
            memory: zod_1.z.boolean().default(true),
            mcp: zod_1.z.boolean().default(true),
            servicenow: zod_1.z.boolean().default(true),
            queen: zod_1.z.boolean().default(true),
        })
            .default({
            memory: true,
            mcp: true,
            servicenow: true,
            queen: true,
        }),
        thresholds: zod_1.z
            .object({
            responseTime: zod_1.z.number().min(100).default(5000), // ms
            memoryUsage: zod_1.z.number().min(100).default(1000), // MB
            queueSize: zod_1.z.number().min(10).default(100),
        })
            .default({
            responseTime: 5000,
            memoryUsage: 1000,
            queueSize: 100,
        }),
    })
        .default({
        checks: {
            memory: true,
            mcp: true,
            servicenow: true,
            queen: true,
        },
        thresholds: {
            responseTime: 5000,
            memoryUsage: 1000,
            queueSize: 100,
        },
    }),
    // Feature flags
    features: zod_1.z
        .object({
        autoPermissions: zod_1.z.boolean().default(false),
        smartDiscovery: zod_1.z.boolean().default(true),
        liveTesting: zod_1.z.boolean().default(true),
        autoDeploy: zod_1.z.boolean().default(true),
        autoRollback: zod_1.z.boolean().default(true),
        sharedMemory: zod_1.z.boolean().default(true),
        progressMonitoring: zod_1.z.boolean().default(true),
        neuralPatterns: zod_1.z.boolean().default(false),
        cognitiveAnalysis: zod_1.z.boolean().default(false),
    })
        .default({
        autoPermissions: false,
        smartDiscovery: true,
        liveTesting: true,
        autoDeploy: true,
        autoRollback: true,
        sharedMemory: true,
        progressMonitoring: true,
        neuralPatterns: false,
        cognitiveAnalysis: false,
    }),
});
class SnowFlowConfig {
    constructor(overrides) {
        // Determine config path
        this.configPath = path_1.default.join(os_1.default.homedir(), '.snow-flow', 'config.json');
        // Load config from file if exists
        const fileConfig = this.loadFromFile();
        // Load environment variables
        const envConfig = this.loadFromEnvironment();
        // Merge configurations: defaults < file < env < overrides
        const mergedConfig = this.mergeConfigs(this.getDefaults(), fileConfig, envConfig, overrides || {});
        // Validate configuration
        const result = ConfigSchema.safeParse(mergedConfig);
        if (!result.success) {
            throw new Error(`Invalid configuration: ${JSON.stringify(result.error.issues)}`);
        }
        this.config = result.data;
        // Ensure data directories exist
        this.ensureDirectories();
    }
    /**
     * Get the current configuration
     */
    get() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    update(updates) {
        const mergedConfig = this.mergeConfigs(this.config, updates);
        const result = ConfigSchema.safeParse(mergedConfig);
        if (!result.success) {
            throw new Error(`Invalid configuration update: ${JSON.stringify(result.error.issues)}`);
        }
        this.config = result.data;
        this.saveToFile();
    }
    /**
     * Get a specific configuration value
     */
    getValue(path) {
        const keys = path.split('.');
        let value = this.config;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    /**
     * Set a specific configuration value
     */
    setValue(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let obj = this.config;
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
    saveToFile() {
        try {
            const dir = path_1.default.dirname(this.configPath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
        }
        catch (error) {
            console.error('Failed to save configuration:', error);
        }
    }
    /**
     * Load configuration from file
     */
    loadFromFile() {
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                const content = fs_1.default.readFileSync(this.configPath, 'utf8');
                return JSON.parse(content);
            }
        }
        catch (error) {
            console.error('Failed to load configuration from file:', error);
        }
        return {};
    }
    /**
     * Load configuration from environment variables
     */
    loadFromEnvironment() {
        const env = {};
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
            ['deployment', 'intelligent', 'operations', 'flowComposer', 'platformDevelopment'].forEach((server) => {
                env.mcp.servers[server] = env.mcp.servers[server] || {};
                env.mcp.servers[server].host = process.env.MCP_HOST;
            });
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
    getDefaults() {
        return ConfigSchema.parse({});
    }
    /**
     * Merge multiple configuration objects
     */
    mergeConfigs(...configs) {
        const merged = {};
        for (const config of configs) {
            this.deepMerge(merged, config);
        }
        return merged;
    }
    /**
     * Deep merge objects
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            }
            else {
                target[key] = source[key];
            }
        }
    }
    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        const dirs = [
            this.config.system.dataDir,
            path_1.default.join(this.config.system.dataDir, 'memory'),
            path_1.default.join(this.config.system.dataDir, 'logs'),
            path_1.default.join(this.config.system.dataDir, 'cache'),
            path_1.default.join(this.config.system.dataDir, 'sessions'),
        ];
        for (const dir of dirs) {
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
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
exports.SnowFlowConfig = SnowFlowConfig;
// Export singleton instance
exports.snowFlowConfig = new SnowFlowConfig();
//# sourceMappingURL=snow-flow-config.js.map