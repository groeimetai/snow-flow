/**
 * MCP HTTP Server Router
 *
 * NOTE: This route is currently not used. MCP tools are served by the separate
 * MCP Server at enterprise.snow-flow.dev. This file remains for potential
 * future proxy functionality.
 *
 * The actual enterprise tools (Jira, Azure DevOps, Confluence) are now in:
 * /Users/nielsvanderwerf/snow-flow-enterprise/mcp-server/src/integrations/
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'MCP tools are available via enterprise.snow-flow.dev',
    mcpServerUrl: process.env.ENTERPRISE_MCP_URL || 'https://enterprise.snow-flow.dev'
  });
});

/**
 * List available tools (proxy to MCP server if needed)
 */
router.get('/tools', (req: Request, res: Response) => {
  res.json({
    message: 'Tools are available via the MCP Server',
    mcpServerUrl: process.env.ENTERPRISE_MCP_URL || 'https://enterprise.snow-flow.dev',
    sseEndpoint: '/mcp/sse',
    documentation: 'See MCP server documentation for tool definitions'
  });
});

export default router;
