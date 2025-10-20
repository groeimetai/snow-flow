#!/usr/bin/env node
"use strict";
/**
 * ServiceNow MCP Server
 * Provides Claude Code with direct access to ServiceNow APIs via MCP protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
class ServiceNowMCPServer {
    constructor(config) {
        this.isAuthenticated = false;
        this.config = config;
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        this.snowClient = new servicenow_client_js_1.ServiceNowClient();
        this.server = new index_js_1.Server({
            name: config.name,
            version: config.version,
        }, {
            capabilities: {
                tools: {}
            }
        });
        this.setupToolHandlers();
        this.setupRequestHandlers();
    }
    async checkAuthentication() {
        try {
            this.isAuthenticated = await this.oauth.isAuthenticated();
            return this.isAuthenticated;
        }
        catch (error) {
            console.error('Authentication check failed:', error);
            return false;
        }
    }
    setupRequestHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            const isAuth = await this.checkAuthentication();
            const tools = [
                {
                    name: "snow_auth_status",
                    description: "Check ServiceNow authentication status",
                    inputSchema: {
                        type: "object",
                        properties: {},
                        required: []
                    }
                }
            ];
            if (isAuth) {
                tools.push({
                    name: "snow_create_widget",
                    description: "Create a new ServiceNow Service Portal widget",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Widget name"
                            },
                            id: {
                                type: "string",
                                description: "Widget ID (unique identifier)"
                            },
                            title: {
                                type: "string",
                                description: "Widget display title"
                            },
                            description: {
                                type: "string",
                                description: "Widget description"
                            },
                            template: {
                                type: "string",
                                description: "HTML template for the widget"
                            },
                            css: {
                                type: "string",
                                description: "CSS styling for the widget"
                            },
                            client_script: {
                                type: "string",
                                description: "Client-side AngularJS script"
                            },
                            server_script: {
                                type: "string",
                                description: "Server-side script"
                            },
                            category: {
                                type: "string",
                                description: "Widget category (e.g., 'incident', 'custom')"
                            }
                        },
                        required: ["name", "id", "title", "description", "template", "css", "client_script", "server_script"]
                    }
                }, {
                    name: "snow_update_widget",
                    description: "Update an existing ServiceNow widget",
                    inputSchema: {
                        type: "object",
                        properties: {
                            sys_id: {
                                type: "string",
                                description: "System ID of the widget to update"
                            },
                            updates: {
                                type: "object",
                                description: "Object containing fields to update",
                                properties: {
                                    name: { type: "string" },
                                    title: { type: "string" },
                                    description: { type: "string" },
                                    template: { type: "string" },
                                    css: { type: "string" },
                                    client_script: { type: "string" },
                                    server_script: { type: "string" }
                                }
                            }
                        },
                        required: ["sys_id", "updates"]
                    }
                }, {
                    name: "snow_get_widget",
                    description: "Get details of a ServiceNow widget by ID",
                    inputSchema: {
                        type: "object",
                        properties: {
                            widget_id: {
                                type: "string",
                                description: "Widget ID to retrieve"
                            }
                        },
                        required: ["widget_id"]
                    }
                }, {
                    name: "snow_list_widgets",
                    description: "List all ServiceNow widgets",
                    inputSchema: {
                        type: "object",
                        properties: {
                            limit: {
                                type: "number",
                                description: "Maximum number of widgets to return (default: 50)"
                            }
                        },
                        required: []
                    }
                }, {
                    name: "snow_create_workflow",
                    description: "Create a new ServiceNow workflow",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Workflow name"
                            },
                            description: {
                                type: "string",
                                description: "Workflow description"
                            },
                            active: {
                                type: "boolean",
                                description: "Whether workflow is active"
                            },
                            workflow_version: {
                                type: "string",
                                description: "Workflow version"
                            },
                            table: {
                                type: "string",
                                description: "Table this workflow applies to"
                            },
                            condition: {
                                type: "string",
                                description: "Workflow activation condition"
                            }
                        },
                        required: ["name", "description", "active", "workflow_version"]
                    }
                }, {
                    name: "snow_execute_script",
                    description: "Execute a server-side script in ServiceNow",
                    inputSchema: {
                        type: "object",
                        properties: {
                            script: {
                                type: "string",
                                description: "JavaScript code to execute"
                            },
                            description: {
                                type: "string",
                                description: "Description of what the script does"
                            }
                        },
                        required: ["script"]
                    }
                }, {
                    name: "snow_test_connection",
                    description: "Test connection to ServiceNow and get current user info",
                    inputSchema: {
                        type: "object",
                        properties: {},
                        required: []
                    }
                }, {
                    name: "snow_get_instance_info",
                    description: "Get ServiceNow instance information",
                    inputSchema: {
                        type: "object",
                        properties: {},
                        required: []
                    }
                });
            }
            return { tools };
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case "snow_auth_status":
                        return await this.handleAuthStatus();
                    case "snow_create_widget":
                        return await this.handleCreateWidget(args);
                    case "snow_update_widget":
                        return await this.handleUpdateWidget(args);
                    case "snow_get_widget":
                        return await this.handleGetWidget(args);
                    case "snow_list_widgets":
                        return await this.handleListWidgets(args);
                    case "snow_create_workflow":
                        return await this.handleCreateWorkflow(args);
                    case "snow_execute_script":
                        return await this.handleExecuteScript(args);
                    case "snow_test_connection":
                        return await this.handleTestConnection();
                    case "snow_get_instance_info":
                        return await this.handleGetInstanceInfo();
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error executing ${name}: ${errorMessage}`
                        }
                    ]
                };
            }
        });
    }
    async handleAuthStatus() {
        const isAuth = await this.checkAuthentication();
        const credentials = await this.oauth.loadCredentials();
        let statusText = "🔐 ServiceNow Authentication Status:\n\n";
        if (isAuth && credentials) {
            statusText += `✅ Status: Authenticated\n`;
            statusText += `🏢 Instance: ${credentials.instance}\n`;
            statusText += `🔑 Client ID: ${credentials.clientId}\n`;
            statusText += `📅 Expires: ${credentials.expiresAt ? new Date(credentials.expiresAt).toLocaleString() : 'Unknown'}\n`;
        }
        else {
            statusText += `❌ Status: Not authenticated\n`;
            statusText += `💡 Run "snow-flow auth login" to authenticate\n`;
        }
        return {
            content: [
                {
                    type: "text",
                    text: statusText
                }
            ]
        };
    }
    async handleCreateWidget(args) {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.createWidget({
            name: args.name,
            id: args.id,
            title: args.title,
            description: args.description,
            template: args.template,
            css: args.css,
            client_script: args.client_script,
            script: args.server_script, // Map server_script to script field
            category: args.category || 'custom'
        });
        if (result.success) {
            const credentials = await this.oauth.loadCredentials();
            const instanceUrl = `https://${credentials?.instance}`;
            const widgetUrl = `${instanceUrl}/sp_config/?id=widget_editor&widget_id=${result.data?.sys_id}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Widget created successfully!\n\n` +
                            `🆔 Widget ID: ${result.data?.sys_id}\n` +
                            `📛 Name: ${result.data?.name}\n` +
                            `🔗 Edit Widget: ${widgetUrl}\n` +
                            `🌐 Instance: ${instanceUrl}\n\n` +
                            `The widget has been created in your ServiceNow instance and is ready for testing!`
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to create widget: ${result.error}`
                    }
                ]
            };
        }
    }
    async handleUpdateWidget(args) {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.updateWidget(args.sys_id, args.updates);
        if (result.success) {
            const credentials = await this.oauth.loadCredentials();
            const instanceUrl = `https://${credentials?.instance}`;
            const widgetUrl = `${instanceUrl}/sp_config/?id=widget_editor&widget_id=${args.sys_id}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Widget updated successfully!\n\n` +
                            `🆔 Widget ID: ${args.sys_id}\n` +
                            `🔗 Edit Widget: ${widgetUrl}\n` +
                            `🌐 Instance: ${instanceUrl}\n\n` +
                            `The widget has been updated in your ServiceNow instance!`
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to update widget: ${result.error}`
                    }
                ]
            };
        }
    }
    async handleGetWidget(args) {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.getWidget(args.widget_id);
        if (result.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Widget found!\n\n` +
                            `🆔 System ID: ${result.data?.sys_id}\n` +
                            `📛 Name: ${result.data?.name}\n` +
                            `🏷️ ID: ${result.data?.id}\n` +
                            `📝 Title: ${result.data?.title}\n` +
                            `📄 Description: ${result.data?.description}\n` +
                            `🏷️ Category: ${result.data?.category}\n\n` +
                            `Template:\n${result.data?.template}\n\n` +
                            `CSS:\n${result.data?.css}\n\n` +
                            `Client Script:\n${result.data?.client_script}\n\n` +
                            `Server Script:\n${result.data?.script}` // ServiceNow uses 'script' field
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Widget not found: ${result.error}`
                    }
                ]
            };
        }
    }
    async handleListWidgets(args) {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.getWidgets();
        if (result.success && result.result) {
            const widgets = result.result.slice(0, args.limit || 50);
            let widgetList = `✅ Found ${widgets.length} widgets:\n\n`;
            widgets.forEach((widget, index) => {
                widgetList += `${index + 1}. ${widget.name} (${widget.id})\n`;
                widgetList += `   🆔 System ID: ${widget.sys_id}\n`;
                widgetList += `   📝 Title: ${widget.title}\n`;
                widgetList += `   📄 Description: ${widget.description}\n`;
                widgetList += `   🏷️ Category: ${widget.category}\n\n`;
            });
            return {
                content: [
                    {
                        type: "text",
                        text: widgetList
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to list widgets: ${result.error}`
                    }
                ]
            };
        }
    }
    async handleCreateWorkflow(args) {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.createWorkflow({
            name: args.name,
            description: args.description,
            active: args.active,
            workflow_version: args.workflow_version,
            table: args.table,
            condition: args.condition
        });
        if (result.success) {
            const credentials = await this.oauth.loadCredentials();
            const instanceUrl = `https://${credentials?.instance}`;
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Workflow created successfully!\n\n` +
                            `🆔 Workflow ID: ${result.data?.sys_id}\n` +
                            `📛 Name: ${result.data?.name}\n` +
                            `🌐 Instance: ${instanceUrl}\n\n` +
                            `The workflow has been created in your ServiceNow instance!`
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to create workflow: ${result.error}`
                    }
                ]
            };
        }
    }
    async handleExecuteScript(args) {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.executeScript(args.script);
        if (result.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Script executed successfully!\n\n` +
                            `📄 Description: ${args.description || 'No description provided'}\n` +
                            `⚡ Script:\n${args.script}\n\n` +
                            `📊 Result:\n${JSON.stringify(result.data, null, 2)}`
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to execute script: ${result.error}`
                    }
                ]
            };
        }
    }
    async handleTestConnection() {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.testConnection();
        if (result.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Connection test successful!\n\n` +
                            `👤 User: ${result.data?.name} (${result.data?.user_name})\n` +
                            `📧 Email: ${result.data?.email}\n` +
                            `🏢 Company: ${result.data?.company?.display_value || 'N/A'}\n` +
                            `🎭 Role: ${result.data?.title || 'N/A'}\n` +
                            `📅 Last Login: ${result.data?.last_login_time || 'N/A'}\n\n` +
                            `ServiceNow connection is working properly!`
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Connection test failed: ${result.error}`
                    }
                ]
            };
        }
    }
    async handleGetInstanceInfo() {
        if (!await this.checkAuthentication()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "❌ Not authenticated. Please run 'snow-flow auth login' first."
                    }
                ]
            };
        }
        const result = await this.snowClient.getInstanceInfo();
        if (result.success) {
            const credentials = await this.oauth.loadCredentials();
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Instance information retrieved!\n\n` +
                            `🏢 Instance: ${credentials?.instance}\n` +
                            `🌐 URL: https://${credentials?.instance}\n` +
                            `📊 Property: ${result.data?.name}\n` +
                            `💾 Value: ${result.data?.value}\n\n` +
                            `Instance is accessible and responding!`
                    }
                ]
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to get instance info: ${result.error}`
                    }
                ]
            };
        }
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        // Keep the server running
        await new Promise((resolve) => {
            process.on('SIGINT', () => {
                console.error('\nServiceNow MCP Server shutting down...');
                resolve();
            });
        });
    }
}
exports.ServiceNowMCPServer = ServiceNowMCPServer;
// CLI entry point
async function main() {
    const config = {
        name: "servicenow-mcp-server",
        version: "1.0.0"
    };
    const server = new ServiceNowMCPServer(config);
    await server.run();
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=servicenow-mcp-server.js.map