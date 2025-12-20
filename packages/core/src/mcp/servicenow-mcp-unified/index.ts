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
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Main entry point
 */
async function main() {
  try {
    // Load environment variables from .env file
    // Search in current directory and parent directories
    const result = dotenv.config();

    if (result.error) {
      // Try loading from parent directory (common when MCP server is in subdirectory)
      const parentEnvPath = path.resolve(process.cwd(), '..', '.env');
      const parentResult = dotenv.config({ path: parentEnvPath });

      if (parentResult.error) {
        console.warn('[Main] No .env file found - using environment variables from MCP configuration');
      } else {
        console.log('[Main] Loaded environment from parent directory:', parentEnvPath);
      }
    } else {
      console.log('[Main] Loaded environment from .env file');
    }

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
