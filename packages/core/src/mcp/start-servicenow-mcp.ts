#!/usr/bin/env node
/**
 * ServiceNow MCP Server Launcher
 * Starts the ServiceNow MCP server with proper configuration
 */

import { ServiceNowMCPServer } from './servicenow-mcp-server.js';
import { ServiceNowOAuth } from '../utils/snow-oauth.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function startServiceNowMCPServer() {
  console.error('🚀 Starting ServiceNow MCP Server...');
  
  // Check if OAuth is configured
  const oauth = new ServiceNowOAuth();
  const isAuthenticated = await oauth.isAuthenticated();
  
  if (isAuthenticated) {
    console.error('✅ ServiceNow OAuth authentication detected');
    const credentials = await oauth.loadCredentials();
    console.error(`🏢 Instance: ${credentials?.instance}`);
  } else {
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
  
  const server = new ServiceNowMCPServer(config);
  
  console.error('🌐 ServiceNow MCP Server is running...');
  console.error('💡 This server provides Claude Code with direct access to ServiceNow APIs');
  console.error('🔧 Available tools depend on authentication status');
  console.error('🛑 Press Ctrl+C to stop the server');
  console.error('');
  
  try {
    await server.run();
  } catch (error) {
    console.error('❌ MCP Server error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServiceNowMCPServer().catch(console.error);
}