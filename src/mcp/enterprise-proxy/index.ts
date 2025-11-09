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
  try {
    const tools = await listEnterpriseTools();

    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description || `Enterprise tool: ${tool.name}`,
        inputSchema: tool.inputSchema,
      })),
    };
  } catch (error) {
    // Return empty list on error (allows MCP server to start even if enterprise server is down)
    console.error(
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

  try {
    const result = await proxyToolCall(name, args || {});

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
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log to stderr (stdout is reserved for MCP protocol)
    console.error('[Enterprise Proxy] Snow-Flow Enterprise MCP Proxy started');
    console.error(`[Enterprise Proxy] Version: ${VERSION}`);
    console.error(
      `[Enterprise Proxy] Enterprise URL: ${process.env.SNOW_ENTERPRISE_URL || 'https://license-server.run.app'}`
    );
    console.error(
      `[Enterprise Proxy] License Key: ${process.env.SNOW_LICENSE_KEY ? '✓ Configured' : '✗ Not configured'}`
    );
  } catch (error) {
    console.error(
      '[Enterprise Proxy] Fatal error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.error('[Enterprise Proxy] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[Enterprise Proxy] Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start server
main().catch((error) => {
  console.error(
    '[Enterprise Proxy] Startup failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
