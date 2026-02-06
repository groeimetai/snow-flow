#!/usr/bin/env node
/**
 * Snow-Flow Enterprise MCP Proxy
 * Bridges SnowCode CLI (stdio MCP) with Enterprise License Server (HTTPS REST)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { proxyToolCall, listEnterpriseTools } from './proxy.js';
import { mcpDebug } from '../shared/mcp-debug.js';

const VERSION = process.env.SNOW_FLOW_VERSION || '8.30.31';

/**
 * Create MCP Server
 */
const server = new Server(
  {
    name: 'snow-flow-enterprise-proxy',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handle tools/list request
 * Returns list of available enterprise tools from license server
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  mcpDebug('[Enterprise Proxy] Received tools/list request from MCP client');

  try {
    const tools = await listEnterpriseTools();

    mcpDebug(`[Enterprise Proxy] Returning ${tools.length} tools to MCP client`);

    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description || `Enterprise tool: ${tool.name}`,
        inputSchema: tool.inputSchema,
      })),
    };
  } catch (error) {
    // Return empty list on error (allows MCP server to start even if enterprise server is down)
    mcpDebug('[Enterprise Proxy] Failed to list tools - returning empty list', {
      error: error instanceof Error ? error.message : String(error)
    });
    mcpDebug(
      `[Enterprise Proxy] Failed to list tools: ${error instanceof Error ? error.message : String(error)}`
    );
    return { tools: [] };
  }
});

/**
 * Handle tools/call request
 * Proxies tool call to enterprise license server via HTTPS
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  mcpDebug(`[Enterprise Proxy] Received tool call: ${name}`, {
    arguments: args
  });

  try {
    const result = await proxyToolCall(name, args || {});

    mcpDebug(`[Enterprise Proxy] Tool call succeeded: ${name}`);

    // Format result as MCP response
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    // Return error as MCP response
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    mcpDebug(`[Enterprise Proxy] Tool call failed: ${name}`, {
      error: errorMessage
    });

    return {
      content: [
        {
          type: 'text',
          text: `❌ Enterprise tool error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start MCP Server with stdio transport
 */
async function main() {
  try {
    mcpDebug('[Enterprise Proxy] Starting Enterprise Proxy MCP Server', {
      version: VERSION,
      enterpriseUrl: process.env.SNOW_ENTERPRISE_URL || 'https://enterprise.snow-flow.dev',
      licenseKeyConfigured: !!process.env.SNOW_LICENSE_KEY,
      cwd: process.cwd()
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log to stderr (stdout is reserved for MCP protocol)
    mcpDebug('[Enterprise Proxy] Snow-Flow Enterprise MCP Proxy started');
    mcpDebug(`[Enterprise Proxy] Version: ${VERSION}`);
    mcpDebug(
      `[Enterprise Proxy] Enterprise URL: ${process.env.SNOW_ENTERPRISE_URL || 'https://enterprise.snow-flow.dev'}`
    );
    mcpDebug(
      `[Enterprise Proxy] License Key: ${process.env.SNOW_LICENSE_KEY ? '✓ Configured' : '✗ Not configured'}`
    );

    mcpDebug('[Enterprise Proxy] Enterprise Proxy successfully started and ready for requests');
  } catch (error) {
    mcpDebug('[Enterprise Proxy] Fatal startup error', {
      error: error instanceof Error ? error.message : String(error)
    });
    mcpDebug(
      '[Enterprise Proxy] Fatal error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  mcpDebug('[Enterprise Proxy] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  mcpDebug('[Enterprise Proxy] Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start server
main().catch((error) => {
  mcpDebug(
    '[Enterprise Proxy] Startup failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
