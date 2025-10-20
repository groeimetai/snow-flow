"use strict";
/**
 * MCP Tool Manager - OpenCode Compatible
 * Manages connections to MCP servers and converts tools to Vercel AI SDK format
 *
 * Purpose:
 * - Connect to local MCP servers (stdio transport)
 * - Discover available tools from all connected servers
 * - Convert MCP tool schemas to Vercel AI SDK CoreTool format
 * - Execute tool calls via MCP protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPToolManager = void 0;
exports.getDefaultMCPServerConfigs = getDefaultMCPServerConfigs;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const logger_js_1 = require("../utils/logger.js");
const child_process_1 = require("child_process");
/**
 * MCP Tool Manager
 * Connects to MCP servers and manages tool integration
 */
class MCPToolManager {
    constructor() {
        this.servers = new Map();
        this.tools = new Map();
        this.connected = false;
        this.logger = new logger_js_1.Logger('MCPToolManager');
    }
    /**
     * Connect to all configured MCP servers
     */
    async connectToServers(configs) {
        this.logger.info(`🔌 Connecting to ${configs.length} MCP servers...`);
        for (const config of configs) {
            if (config.enabled === false) {
                this.logger.info(`⏭️  Skipping disabled server: ${config.name}`);
                continue;
            }
            try {
                await this.connectToServer(config);
                this.logger.info(`✅ Connected to ${config.name}`);
            }
            catch (error) {
                this.logger.error(`❌ Failed to connect to ${config.name}:`, error);
            }
        }
        // Discover all tools after connecting to servers
        await this.discoverTools();
        this.connected = true;
        this.logger.info(`🎉 MCP Tool Manager ready with ${this.tools.size} tools`);
    }
    /**
     * Connect to a single MCP server via stdio transport
     */
    async connectToServer(config) {
        this.logger.info(`   Connecting to ${config.name}...`);
        this.logger.debug(`   Command: ${config.command} ${(config.args || []).join(' ')}`);
        // Spawn MCP server process
        const serverProcess = (0, child_process_1.spawn)(config.command, config.args || [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ...config.env }
        });
        // Handle process errors
        serverProcess.on('error', (error) => {
            this.logger.error(`MCP server ${config.name} process error:`, error);
        });
        serverProcess.stderr?.on('data', (data) => {
            this.logger.debug(`MCP server ${config.name} stderr: ${data.toString().trim()}`);
        });
        // Create stdio transport
        const transport = new stdio_js_1.StdioClientTransport({
            command: config.command,
            args: config.args || [],
            env: { ...process.env, ...config.env }
        });
        // Create MCP client
        const client = new index_js_1.Client({
            name: 'snow-flow-universal',
            version: '6.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        // Connect client to transport
        await client.connect(transport);
        // Store connection
        this.servers.set(config.name, {
            client,
            transport,
            process: serverProcess
        });
        this.logger.info(`   ✓ ${config.name} connected`);
    }
    /**
     * Discover tools from all connected servers
     */
    async discoverTools() {
        this.logger.info('🔍 Discovering tools from MCP servers...');
        for (const [serverName, { client }] of this.servers.entries()) {
            try {
                const response = await client.listTools();
                this.logger.info(`   ${serverName}: ${response.tools.length} tools`);
                for (const tool of response.tools) {
                    const toolInfo = {
                        name: tool.name,
                        description: tool.description || 'No description provided',
                        schema: tool.inputSchema,
                        serverName
                    };
                    this.tools.set(tool.name, toolInfo);
                }
            }
            catch (error) {
                this.logger.error(`Failed to discover tools from ${serverName}:`, error);
            }
        }
        this.logger.info(`✓ Discovered ${this.tools.size} total tools`);
    }
    /**
     * Get all tools in Vercel AI SDK format
     */
    getToolsForAI() {
        const aiTools = {};
        for (const [toolName, toolInfo] of this.tools.entries()) {
            aiTools[toolName] = {
                description: toolInfo.description,
                inputSchema: toolInfo.schema,
                execute: async (args) => {
                    return await this.executeTool(toolName, args);
                }
            };
        }
        return aiTools;
    }
    /**
     * Execute a tool via MCP
     */
    async executeTool(toolName, args) {
        const toolInfo = this.tools.get(toolName);
        if (!toolInfo) {
            throw new Error(`Tool not found: ${toolName}`);
        }
        const server = this.servers.get(toolInfo.serverName);
        if (!server) {
            throw new Error(`Server not connected: ${toolInfo.serverName}`);
        }
        this.logger.debug(`🔧 Executing tool: ${toolName}`);
        this.logger.debug(`   Server: ${toolInfo.serverName}`);
        this.logger.debug(`   Args: ${JSON.stringify(args).substring(0, 200)}`);
        try {
            const response = await server.client.callTool({
                name: toolName,
                arguments: args
            });
            this.logger.debug(`   ✓ Tool executed successfully`);
            // Return the content from the MCP response
            if (response.content && Array.isArray(response.content) && response.content.length > 0) {
                // If there's a text response, return it
                const textContent = response.content.find((c) => c.type === 'text');
                if (textContent && 'text' in textContent) {
                    return textContent.text;
                }
                // Otherwise return the first content item
                return JSON.stringify(response.content[0]);
            }
            return 'Tool executed successfully';
        }
        catch (error) {
            this.logger.error(`Failed to execute tool ${toolName}:`, error);
            throw error;
        }
    }
    /**
     * Get tool information
     */
    getToolInfo(toolName) {
        return this.tools.get(toolName);
    }
    /**
     * Get all tool names
     */
    getToolNames() {
        return Array.from(this.tools.keys());
    }
    /**
     * Get tools grouped by server
     */
    getToolsByServer() {
        const grouped = new Map();
        for (const [toolName, toolInfo] of this.tools.entries()) {
            if (!grouped.has(toolInfo.serverName)) {
                grouped.set(toolInfo.serverName, []);
            }
            grouped.get(toolInfo.serverName).push(toolName);
        }
        return grouped;
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Shutdown all MCP connections
     */
    async shutdown() {
        this.logger.info('🔌 Shutting down MCP Tool Manager...');
        for (const [serverName, { client, transport, process }] of this.servers.entries()) {
            try {
                this.logger.info(`   Disconnecting ${serverName}...`);
                // Close client connection
                await client.close();
                // Kill server process
                if (process && !process.killed) {
                    process.kill('SIGTERM');
                    // Wait for process to exit (with timeout)
                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            if (!process.killed) {
                                process.kill('SIGKILL');
                            }
                            resolve();
                        }, 5000);
                        process.once('exit', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                }
                this.logger.info(`   ✓ ${serverName} disconnected`);
            }
            catch (error) {
                this.logger.error(`Failed to shutdown ${serverName}:`, error);
            }
        }
        this.servers.clear();
        this.tools.clear();
        this.connected = false;
        this.logger.info('✓ MCP Tool Manager shut down');
    }
}
exports.MCPToolManager = MCPToolManager;
/**
 * Get default Snow-Flow MCP server configurations
 */
function getDefaultMCPServerConfigs() {
    return [
        {
            name: 'servicenow-unified',
            command: 'node',
            args: ['dist/mcp/servicenow-mcp-unified/index.js'],
            env: {
                SNOW_INSTANCE: process.env.SNOW_INSTANCE || '',
                SNOW_CLIENT_ID: process.env.SNOW_CLIENT_ID || '',
                SNOW_CLIENT_SECRET: process.env.SNOW_CLIENT_SECRET || '',
                SNOW_USERNAME: process.env.SNOW_USERNAME || '',
                SNOW_PASSWORD: process.env.SNOW_PASSWORD || ''
            },
            enabled: true
        },
        {
            name: 'snow-flow-orchestration',
            command: 'node',
            args: ['dist/servers/snow-flow-orchestration-server.js'],
            enabled: true
        }
    ];
}
//# sourceMappingURL=mcp-tool-manager.js.map