#!/usr/bin/env node
/**
 * ServiceNow Unified MCP Server Entry Point
 *
 * Consolidates 34 separate ServiceNow MCP servers into a single
 * unified server with auto-discovery of 235+ tools.
 *
 * Usage:
 *   node dist/mcp/servicenow-mcp-unified/index.js
 *
 * Environment Variables:
 *   SERVICENOW_INSTANCE_URL - ServiceNow instance URL
 *   SERVICENOW_CLIENT_ID - OAuth client ID
 *   SERVICENOW_CLIENT_SECRET - OAuth client secret
 *   SERVICENOW_REFRESH_TOKEN - OAuth refresh token (optional, will be cached)
 */

import { ServiceNowUnifiedServer } from './server.js';

/**
 * Main entry point
 */
async function main() {
  try {
    // Create server instance
    const server = new ServiceNowUnifiedServer();

    // Initialize (discover tools, validate auth)
    await server.initialize();

    // Start server with stdio transport
    await server.start();

    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
      console.log('\n[Main] Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n[Main] Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

  } catch (error: any) {
    console.error('[Main] Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run server
main();
