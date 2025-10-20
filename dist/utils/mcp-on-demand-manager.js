"use strict";
/**
 * MCP On-Demand Manager
 * Starts MCP servers only when needed and stops them after inactivity
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPOnDemandManager = void 0;
const child_process_1 = require("child_process");
const logger_js_1 = require("./logger.js");
const mcp_process_manager_js_1 = require("./mcp-process-manager.js");
const unified_auth_store_js_1 = require("./unified-auth-store.js");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger = new logger_js_1.Logger('MCPOnDemand');
class MCPOnDemandManager {
    constructor() {
        this.servers = new Map();
        this.inactivityTimeout = parseInt(process.env.SNOW_MCP_INACTIVITY_TIMEOUT || '300000'); // 5 minutes default
        this.startInactivityMonitor();
    }
    static getInstance() {
        if (!MCPOnDemandManager.instance) {
            MCPOnDemandManager.instance = new MCPOnDemandManager();
        }
        return MCPOnDemandManager.instance;
    }
    /**
     * Get or start an MCP server on demand
     */
    async getServer(serverName) {
        let server = this.servers.get(serverName);
        if (!server) {
            server = {
                name: serverName,
                lastUsed: Date.now(),
                useCount: 0,
                status: 'stopped'
            };
            this.servers.set(serverName, server);
        }
        // Update last used time
        server.lastUsed = Date.now();
        server.useCount++;
        // If server is running, return it
        if (server.status === 'running' && server.process) {
            logger.debug(`✅ Reusing existing ${serverName} (used ${server.useCount} times)`);
            return server.process;
        }
        // If server is starting, wait for it
        if (server.status === 'starting') {
            logger.debug(`⏳ Waiting for ${serverName} to start...`);
            return this.waitForServer(serverName);
        }
        // Start the server
        return this.startServer(serverName);
    }
    /**
     * Start an MCP server
     */
    async startServer(serverName) {
        const server = this.servers.get(serverName);
        if (!server) {
            throw new Error(`Server ${serverName} not found`);
        }
        // Check resource limits
        const processManager = mcp_process_manager_js_1.MCPProcessManager.getInstance();
        if (!processManager.canSpawnServer()) {
            // Try to free up resources by stopping least recently used servers
            await this.stopLeastRecentlyUsed();
            if (!processManager.canSpawnServer()) {
                throw new Error('Cannot start server: resource limits exceeded');
            }
        }
        server.status = 'starting';
        logger.info(`🚀 Starting ${serverName} on demand...`);
        try {
            // Get the script path
            const scriptPath = this.getScriptPath(serverName);
            // Get auth tokens
            await unified_auth_store_js_1.unifiedAuthStore.bridgeToMCP();
            const tokens = await unified_auth_store_js_1.unifiedAuthStore.getTokens();
            const authEnv = {};
            if (tokens) {
                authEnv.SNOW_OAUTH_TOKENS = JSON.stringify(tokens);
                authEnv.SNOW_INSTANCE = tokens.instance;
                authEnv.SNOW_CLIENT_ID = tokens.clientId;
                authEnv.SNOW_CLIENT_SECRET = tokens.clientSecret;
                if (tokens.accessToken) {
                    authEnv.SNOW_ACCESS_TOKEN = tokens.accessToken;
                }
                if (tokens.refreshToken) {
                    authEnv.SNOW_REFRESH_TOKEN = tokens.refreshToken;
                }
            }
            // Start the process
            const childProcess = (0, child_process_1.spawn)('node', [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    ...authEnv,
                    SNOW_MCP_ON_DEMAND: 'true' // Flag to indicate on-demand mode
                }
            });
            // Handle process events
            childProcess.on('error', (error) => {
                logger.error(`${serverName} error:`, error);
                server.status = 'stopped';
            });
            childProcess.on('exit', (code) => {
                logger.info(`${serverName} exited with code ${code}`);
                server.status = 'stopped';
                server.process = undefined;
            });
            // Log output for debugging
            childProcess.stdout?.on('data', (data) => {
                logger.debug(`${serverName} stdout:`, data.toString());
            });
            childProcess.stderr?.on('data', (data) => {
                logger.debug(`${serverName} stderr:`, data.toString());
            });
            server.process = childProcess;
            server.status = 'running';
            server.startTime = Date.now();
            logger.info(`✅ ${serverName} started (PID: ${childProcess.pid})`);
            return childProcess;
        }
        catch (error) {
            server.status = 'stopped';
            throw error;
        }
    }
    /**
     * Wait for a server to finish starting
     */
    async waitForServer(serverName, timeout = 30000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const server = this.servers.get(serverName);
            if (server?.status === 'running' && server.process) {
                return server.process;
            }
            if (server?.status === 'stopped') {
                throw new Error(`Server ${serverName} failed to start`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Timeout waiting for ${serverName} to start`);
    }
    /**
     * Stop a specific server
     */
    async stopServer(serverName) {
        const server = this.servers.get(serverName);
        if (!server || !server.process) {
            return;
        }
        server.status = 'stopping';
        logger.info(`🛑 Stopping ${serverName} (was used ${server.useCount} times)`);
        try {
            server.process.kill('SIGTERM');
            // Wait for graceful shutdown
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    if (server.process) {
                        server.process.kill('SIGKILL');
                    }
                    resolve(undefined);
                }, 5000);
                server.process?.once('exit', () => {
                    clearTimeout(timeout);
                    resolve(undefined);
                });
            });
        }
        catch (error) {
            logger.error(`Error stopping ${serverName}:`, error);
        }
        server.status = 'stopped';
        server.process = undefined;
        server.startTime = undefined;
    }
    /**
     * Stop least recently used servers to free resources
     */
    async stopLeastRecentlyUsed() {
        const runningServers = Array.from(this.servers.values())
            .filter(s => s.status === 'running')
            .sort((a, b) => a.lastUsed - b.lastUsed);
        if (runningServers.length > 0) {
            const oldest = runningServers[0];
            logger.info(`📦 Stopping least recently used server: ${oldest.name}`);
            await this.stopServer(oldest.name);
        }
    }
    /**
     * Stop all inactive servers
     */
    async stopInactiveServers() {
        const now = Date.now();
        const promises = [];
        for (const [name, server] of this.servers) {
            if (server.status === 'running' &&
                now - server.lastUsed > this.inactivityTimeout) {
                const inactiveMinutes = Math.round((now - server.lastUsed) / 60000);
                logger.info(`⏰ Stopping ${name} due to inactivity (${inactiveMinutes} minutes)`);
                promises.push(this.stopServer(name));
            }
        }
        await Promise.all(promises);
    }
    /**
     * Start monitoring for inactive servers
     */
    startInactivityMonitor() {
        // Check every minute
        this.cleanupInterval = setInterval(() => {
            this.stopInactiveServers().catch(error => {
                logger.error('Error during inactivity cleanup:', error);
            });
        }, 60000);
        // Don't block process exit
        this.cleanupInterval.unref();
    }
    /**
     * Stop the inactivity monitor
     */
    stopInactivityMonitor() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }
    /**
     * Get the script path for a server
     */
    getScriptPath(serverName) {
        // Map server names to script files
        const serverMap = {
            'servicenow-operations': 'servicenow-operations-mcp.js',
            'servicenow-deployment': 'servicenow-deployment-mcp.js',
            'servicenow-machine-learning': 'servicenow-machine-learning-mcp.js',
            'servicenow-update-set': 'servicenow-update-set-mcp.js',
            'servicenow-platform-development': 'servicenow-platform-development-mcp.js',
            'servicenow-integration': 'servicenow-integration-mcp.js',
            'servicenow-automation': 'servicenow-automation-mcp.js',
            'servicenow-security-compliance': 'servicenow-security-compliance-mcp.js',
            'servicenow-reporting-analytics': 'servicenow-reporting-analytics-mcp.js',
            'servicenow-flow-composer': 'servicenow-flow-composer-mcp.js',
            'servicenow-intelligent': 'servicenow-intelligent-mcp.js',
            'servicenow-development-assistant': 'servicenow-development-assistant-mcp.js',
            'servicenow-graph-memory': 'servicenow-graph-memory-mcp.js',
            'snow-flow': 'snow-flow-mcp.js'
        };
        const scriptFile = serverMap[serverName];
        if (!scriptFile) {
            throw new Error(`Unknown server: ${serverName}`);
        }
        // Check different possible locations
        const possiblePaths = [
            path_1.default.join(__dirname, '..', 'mcp', scriptFile),
            path_1.default.join(process.cwd(), 'dist', 'mcp', scriptFile),
            path_1.default.join('/Users/nielsvanderwerf/.nvm/versions/node/v20.15.0/lib/node_modules/snow-flow/dist/mcp', scriptFile)
        ];
        for (const scriptPath of possiblePaths) {
            if (fs_1.default.existsSync(scriptPath)) {
                return scriptPath;
            }
        }
        throw new Error(`Script not found for ${serverName}: ${scriptFile}`);
    }
    /**
     * Get status of all servers
     */
    getStatus() {
        const servers = Array.from(this.servers.values()).map(server => {
            const lastUsedMinutes = Math.round((Date.now() - server.lastUsed) / 60000);
            const uptime = server.startTime ?
                Math.round((Date.now() - server.startTime) / 60000) + ' minutes' :
                undefined;
            return {
                name: server.name,
                status: server.status,
                lastUsed: `${lastUsedMinutes} minutes ago`,
                useCount: server.useCount,
                uptime
            };
        });
        return {
            total: servers.length,
            running: servers.filter(s => s.status === 'running').length,
            stopped: servers.filter(s => s.status === 'stopped').length,
            servers
        };
    }
    /**
     * Stop all servers
     */
    async stopAll() {
        logger.info('🛑 Stopping all MCP servers...');
        const promises = Array.from(this.servers.keys()).map(name => this.stopServer(name));
        await Promise.all(promises);
        this.stopInactivityMonitor();
    }
}
exports.MCPOnDemandManager = MCPOnDemandManager;
//# sourceMappingURL=mcp-on-demand-manager.js.map