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
  console.log('🚀 Starting ServiceNow MCP Server...');
  
  // Check if OAuth is configured
  const oauth = new ServiceNowOAuth();
  const isAuthenticated = await oauth.isAuthenticated();
  
  if (isAuthenticated) {
    console.log('✅ ServiceNow OAuth authentication detected');
    const credentials = await oauth.loadCredentials();
    console.log(`🏢 Instance: ${credentials?.instance}`);
  } else {
    console.log('⚠️  ServiceNow OAuth not configured');
    console.log('💡 Some tools will be unavailable until authentication is complete');
    console.log('🔑 Run "snow-flow auth login" to authenticate');
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
  
  console.log('🔧 MCP Server Configuration:');
  console.log(`   📛 Name: ${config.name}`);
  console.log(`   🏷️ Version: ${config.version}`);
  console.log(`   🏢 Instance: ${config.oauth.instance || 'Not configured'}`);
  console.log(`   🔑 Client ID: ${config.oauth.clientId ? '✅ Set' : '❌ Not set'}`);
  console.log(`   🔐 Client Secret: ${config.oauth.clientSecret ? '✅ Set' : '❌ Not set'}`);
  console.log('');
  
  const server = new ServiceNowMCPServer(config);
  
  console.log('🌐 ServiceNow MCP Server is running...');
  console.log('💡 This server provides Claude Code with direct access to ServiceNow APIs');
  console.log('🔧 Available tools depend on authentication status');
  console.log('🛑 Press Ctrl+C to stop the server');
  console.log('');
  
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