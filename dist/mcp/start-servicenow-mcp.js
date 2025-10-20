#!/usr/bin/env node
"use strict";
/**
 * ServiceNow MCP Server Launcher
 * Starts the ServiceNow MCP server with proper configuration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const servicenow_mcp_server_js_1 = require("./servicenow-mcp-server.js");
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
async function startServiceNowMCPServer() {
    console.error('🚀 Starting ServiceNow MCP Server...');
    // Check if OAuth is configured
    const oauth = new snow_oauth_js_1.ServiceNowOAuth();
    const isAuthenticated = await oauth.isAuthenticated();
    if (isAuthenticated) {
        console.error('✅ ServiceNow OAuth authentication detected');
        const credentials = await oauth.loadCredentials();
        console.error(`🏢 Instance: ${credentials?.instance}`);
    }
    else {
        console.error('⚠️  ServiceNow OAuth not configured');
        console.error('💡 Some tools will be unavailable until authentication is complete');
        console.error('🔑 Run "snow-flow auth login" to authenticate');
    }
    const config = {
        name: "servicenow-mcp-server",
        version: "1.0.0",
        oauth: {
            instance: process.env.SNOW_INSTANCE || '',
            clientId: process.env.SNOW_CLIENT_ID || '',
            clientSecret: process.env.SNOW_CLIENT_SECRET || ''
        }
    };
    console.error('🔧 MCP Server Configuration:');
    console.error(`   📛 Name: ${config.name}`);
    console.error(`   🏷️ Version: ${config.version}`);
    console.error(`   🏢 Instance: ${config.oauth.instance || 'Not configured'}`);
    console.error(`   🔑 Client ID: ${config.oauth.clientId ? '✅ Set' : '❌ Not set'}`);
    console.error(`   🔐 Client Secret: ${config.oauth.clientSecret ? '✅ Set' : '❌ Not set'}`);
    console.error('');
    const server = new servicenow_mcp_server_js_1.ServiceNowMCPServer(config);
    console.error('🌐 ServiceNow MCP Server is running...');
    console.error('💡 This server provides Claude Code with direct access to ServiceNow APIs');
    console.error('🔧 Available tools depend on authentication status');
    console.error('🛑 Press Ctrl+C to stop the server');
    console.error('');
    try {
        await server.run();
    }
    catch (error) {
        console.error('❌ MCP Server error:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    startServiceNowMCPServer().catch(console.error);
}
//# sourceMappingURL=start-servicenow-mcp.js.map