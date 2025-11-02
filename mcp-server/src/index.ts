/**
 * Snow-Flow Enterprise MCP Server
 *
 * Remote MCP server for enterprise tools (Jira, Azure DevOps, Confluence).
 * Communicates via Server-Sent Events (SSE) using MCP protocol.
 * Separated from portal for independent scaling.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import winston from 'winston';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { LicenseDatabase } from './database/schema.js';
import { CredentialsDatabase } from './database/credentials-schema.js';
import { ConnectionCleanupWorker } from './workers/connection-cleanup.js';
import jwt from 'jsonwebtoken';

// Import enterprise tools
import {
  jiraSyncBacklog,
  jiraGetIssue,
  jiraCreateIssue,
  jiraUpdateIssue,
  jiraTransitionIssue,
  jiraSearchIssues,
  jiraGetProject,
  jiraLinkIssues
} from './integrations/jira-tools.js';
import {
  azdoSyncWorkItems,
  azdoGetWorkItem,
  azdoCreateWorkItem,
  azdoUpdateWorkItem,
  azdoGetPipelineRuns,
  azdoTriggerPipeline,
  azdoGetPullRequests,
  azdoCreatePullRequest,
  azdoGetReleases,
  azdoCreateRelease
} from './integrations/azdo-tools.js';
import {
  confluenceSyncPages,
  confluenceGetPage,
  confluenceCreatePage,
  confluenceUpdatePage,
  confluenceSearchContent,
  confluenceGetSpace,
  confluenceCreateSpace,
  confluenceLinkPages
} from './integrations/confluence-tools.js';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'mcp-server.log' })
  ]
});

// Database instances
let db: LicenseDatabase;
let credsDb: CredentialsDatabase;

// Cleanup worker instance
let cleanupWorker: ConnectionCleanupWorker;

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// MCP Server instance
const mcpServer = new Server({
  name: 'snow-flow-enterprise',
  version: '2.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Tool registry
const ENTERPRISE_TOOLS = [
  // Jira tools
  { name: 'jira_sync_backlog_advanced', handler: jiraSyncBacklog, feature: 'jira', description: 'Bidirectional Jira backlog sync with AI parsing' },
  { name: 'jira_get_issue', handler: jiraGetIssue, feature: 'jira', description: 'Get Jira issue by key' },
  { name: 'jira_create_issue', handler: jiraCreateIssue, feature: 'jira', description: 'Create new Jira issue' },
  { name: 'jira_update_issue', handler: jiraUpdateIssue, feature: 'jira', description: 'Update existing Jira issue' },
  { name: 'jira_transition_issue', handler: jiraTransitionIssue, feature: 'jira', description: 'Transition Jira issue status' },
  { name: 'jira_search_issues', handler: jiraSearchIssues, feature: 'jira', description: 'Search Jira issues with JQL' },
  { name: 'jira_get_project', handler: jiraGetProject, feature: 'jira', description: 'Get Jira project details' },
  { name: 'jira_link_issues', handler: jiraLinkIssues, feature: 'jira', description: 'Link two Jira issues' },

  // Azure DevOps tools
  { name: 'azure_sync_work_items', handler: azdoSyncWorkItems, feature: 'azure-devops', description: 'Sync Azure DevOps work items to ServiceNow' },
  { name: 'azure_get_work_item', handler: azdoGetWorkItem, feature: 'azure-devops', description: 'Get Azure DevOps work item by ID' },
  { name: 'azure_create_work_item', handler: azdoCreateWorkItem, feature: 'azure-devops', description: 'Create new Azure DevOps work item' },
  { name: 'azure_update_work_item', handler: azdoUpdateWorkItem, feature: 'azure-devops', description: 'Update Azure DevOps work item' },
  { name: 'azure_get_pipeline_runs', handler: azdoGetPipelineRuns, feature: 'azure-devops', description: 'Get Azure pipeline run history' },
  { name: 'azure_trigger_pipeline', handler: azdoTriggerPipeline, feature: 'azure-devops', description: 'Trigger Azure pipeline run' },
  { name: 'azure_get_pull_requests', handler: azdoGetPullRequests, feature: 'azure-devops', description: 'Get Azure DevOps pull requests' },
  { name: 'azure_create_pull_request', handler: azdoCreatePullRequest, feature: 'azure-devops', description: 'Create Azure DevOps pull request' },
  { name: 'azure_get_releases', handler: azdoGetReleases, feature: 'azure-devops', description: 'Get Azure DevOps releases' },
  { name: 'azure_create_release', handler: azdoCreateRelease, feature: 'azure-devops', description: 'Create Azure DevOps release' },

  // Confluence tools
  { name: 'confluence_sync_pages', handler: confluenceSyncPages, feature: 'confluence', description: 'Sync Confluence pages to ServiceNow knowledge base' },
  { name: 'confluence_get_page', handler: confluenceGetPage, feature: 'confluence', description: 'Get Confluence page by ID' },
  { name: 'confluence_create_page', handler: confluenceCreatePage, feature: 'confluence', description: 'Create new Confluence page' },
  { name: 'confluence_update_page', handler: confluenceUpdatePage, feature: 'confluence', description: 'Update Confluence page' },
  { name: 'confluence_search_content', handler: confluenceSearchContent, feature: 'confluence', description: 'Search Confluence content' },
  { name: 'confluence_get_space', handler: confluenceGetSpace, feature: 'confluence', description: 'Get Confluence space details' },
  { name: 'confluence_create_space', handler: confluenceCreateSpace, feature: 'confluence', description: 'Create new Confluence space' },
  { name: 'confluence_link_pages', handler: confluenceLinkPages, feature: 'confluence', description: 'Link Confluence pages' }
];

// Register MCP tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
  // Get client JWT payload from server context
  const jwtPayload = (mcpServer as any)._clientJwt;

  if (!jwtPayload || !jwtPayload.features) {
    return { tools: [] };
  }

  // Filter tools based on license features
  const availableTools = ENTERPRISE_TOOLS.filter(tool =>
    jwtPayload.features.includes(tool.feature)
  ).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: (tool.handler as any).inputSchema || {
      type: 'object',
      properties: {},
      required: []
    }
  }));

  return { tools: availableTools };
});

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Validate arguments are provided
  if (!args) {
    throw new Error(`Tool '${name}' called without required arguments`);
  }

  // Get client JWT payload
  const jwtPayload = (mcpServer as any)._clientJwt;

  if (!jwtPayload) {
    throw new Error('Unauthorized: No JWT token');
  }

  // Find tool
  const tool = ENTERPRISE_TOOLS.find(t => t.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Check feature access
  if (!jwtPayload.features.includes(tool.feature)) {
    throw new Error(`Tool '${name}' requires feature: ${tool.feature}`);
  }

  try {
    // Fetch credentials from database
    const credentials = await credsDb.getCredentials(jwtPayload.customerId, tool.feature);

    if (!credentials) {
      throw new Error(`No credentials configured for ${tool.feature}. Please configure in portal.`);
    }

    // Get customer info for context
    const customer = await db.getCustomerById(jwtPayload.customerId);

    if (!customer) {
      throw new Error(`Customer ${jwtPayload.customerId} not found`);
    }

    // Execute tool with proper signature: (args, customer, toolCredentials)
    // Map credentials to tool-specific format (using any to bypass strict typing)
    const toolCredentials: any = {
      [tool.feature]: credentials
    };

    const result = await tool.handler(args as any, customer, toolCredentials);

    return result;
  } catch (error: any) {
    logger.error(`Tool '${name}' execution failed:`, error);
    throw error;
  }
});

// Create Express app for SSE endpoint
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'snow-flow-enterprise-mcp',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected',
    credentialsDb: credsDb ? 'connected' : 'disconnected',
    tools: ENTERPRISE_TOOLS.length
  });
});

// Heartbeat endpoint (v2.0.0 - Seat Management)
// Called by MCP clients every 30 seconds to maintain connection status
app.post('/mcp/heartbeat', async (req: Request, res: Response) => {
  // Extract JWT from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT
    const jwtPayload: any = jwt.verify(token, JWT_SECRET);

    // Check if this is a seat-managed connection
    if (jwtPayload.machineId && jwtPayload.role) {
      const customerId = jwtPayload.customerId;
      const userId = jwtPayload.machineId;
      const role = jwtPayload.role as 'developer' | 'stakeholder' | 'admin';

      // Update heartbeat timestamp
      const updated = await db.updateConnectionHeartbeat(customerId, userId, role);

      if (!updated) {
        // Connection not found - might have been cleaned up
        logger.warn('Heartbeat for non-existent connection:', {
          customerId,
          role,
          userId: userId.substring(0, 8) + '...'
        });

        res.status(404).json({
          error: 'Connection not found',
          message: 'Please reconnect to establish a new session'
        });
        return;
      }

      // Log heartbeat event (optional - could be noisy, enable for debugging)
      // await db.logConnectionEvent(customerId, userId, role, 'heartbeat', req.ip);

      res.json({
        success: true,
        timestamp: Date.now()
      });
    } else {
      // Legacy mode - no seat tracking
      res.json({
        success: true,
        timestamp: Date.now(),
        legacy: true
      });
    }
  } catch (error: any) {
    logger.error('Heartbeat failed:', error);

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid or expired token' });
    } else {
      res.status(500).json({ error: 'Heartbeat failed' });
    }
  }
});

// SSE endpoint for MCP (v2.0.0 - Seat Management)
app.get('/mcp/sse', async (req: Request, res: Response) => {
  // Extract JWT from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT
    const jwtPayload: any = jwt.verify(token, JWT_SECRET);

    // v2.0.0: Validate seat availability before allowing connection
    if (jwtPayload.machineId && jwtPayload.role && jwtPayload.seatLimitsEnforced) {
      const customerId = jwtPayload.customerId;
      const userId = jwtPayload.machineId; // Already hashed from auth
      const role = jwtPayload.role as 'developer' | 'stakeholder' | 'admin';

      // Get customer to check current seat usage
      const customer = await db.getCustomerById(customerId);
      if (!customer) {
        res.status(401).json({ error: 'Customer not found' });
        return;
      }

      // Check for recent connection (grace period: 5 minutes)
      const recentConnection = await db.getRecentConnection(customerId, userId, 5 * 60 * 1000);

      if (!recentConnection) {
        // No recent connection - need to validate seat availability
        const seatLimit = role === 'developer'
          ? customer.developerSeats
          : customer.stakeholderSeats;

        const activeCount = await db.getActiveConnectionCount(customerId, role);

        // Check if at capacity (unlimited = -1, no limit)
        if (seatLimit !== -1 && activeCount >= seatLimit) {
          // Log rejection event
          await db.logConnectionEvent(
            customerId,
            userId,
            role,
            'rejected',
            req.ip,
            `Seat limit reached: ${activeCount}/${seatLimit}`,
            seatLimit,
            activeCount
          );

          logger.warn('Connection rejected - seat limit reached:', {
            customerId,
            role,
            seatLimit,
            activeCount
          });

          res.status(429).json({
            error: 'Seat limit reached',
            details: `All ${seatLimit} ${role} seats are currently in use`,
            seatLimit,
            activeCount
          });
          return;
        }
      }

      // Track connection (atomic upsert)
      const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const jwtHash = require('crypto').createHash('sha256').update(token).digest('hex');

      await db.trackConnection(
        customerId,
        userId,
        role,
        connectionId,
        req.ip,
        req.headers['user-agent'],
        jwtHash
      );

      // Recalculate active seats
      await db.recalculateActiveSeats(customerId);

      // Log connection event
      await db.logConnectionEvent(
        customerId,
        userId,
        role,
        'connect',
        req.ip
      );

      logger.info('MCP client connected with seat tracking:', {
        customerId,
        role,
        userId: userId.substring(0, 8) + '...', // Log partial hash for privacy
        connectionId
      });

      // Store connection ID for cleanup on disconnect
      (mcpServer as any)._connectionId = connectionId;
      (mcpServer as any)._connectionMeta = { customerId, userId, role };

      // Handle connection close/cleanup
      req.on('close', async () => {
        try {
          await db.removeConnection(customerId, userId, role);
          await db.recalculateActiveSeats(customerId);
          await db.logConnectionEvent(customerId, userId, role, 'disconnect', req.ip);
          logger.info('MCP client disconnected:', { customerId, role, connectionId });
        } catch (cleanupError) {
          logger.error('Cleanup error on disconnect:', cleanupError);
        }
      });
    } else {
      // Legacy path (no seat management)
      logger.info('MCP client connected (legacy mode - no seat tracking):', {
        customerId: jwtPayload.customerId,
        company: jwtPayload.company,
        tier: jwtPayload.tier,
        features: jwtPayload.features
      });
    }

    // Store JWT payload in server context for tool handlers
    (mcpServer as any)._clientJwt = jwtPayload;

    // Create SSE transport
    const transport = new SSEServerTransport('/mcp/messages', res);

    // Connect MCP server to transport
    await mcpServer.connect(transport);

    logger.info('MCP client connected successfully');
  } catch (error: any) {
    logger.error('JWT verification or connection failed:', error);

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid or expired token' });
    } else {
      res.status(500).json({ error: 'Connection failed' });
    }
  }
});

// Message endpoint for SSE
app.post('/mcp/messages', (req: Request, res: Response) => {
  // This is handled by SSE transport internally
  res.json({ received: true });
});

// Start server
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || '8080');

    // Initialize database
    logger.info('🔌 Connecting to database...');

    db = new LicenseDatabase();
    await db.initialize();
    logger.info('✅ License database connected');

    // Initialize credentials database
    credsDb = new CredentialsDatabase();
    await credsDb.initialize();
    logger.info('✅ Credentials database connected');

    // Start cleanup worker (v2.0.0 - Seat Management)
    cleanupWorker = new ConnectionCleanupWorker({
      db,
      logger,
      intervalMs: 60 * 1000, // Run every 60 seconds
      timeoutMs: 2 * 60 * 1000 // 2 minutes timeout
    });
    cleanupWorker.start();
    logger.info('✅ Connection cleanup worker started');

    // Start HTTP server
    app.listen(port, '0.0.0.0', () => {
      logger.info('');
      logger.info('╔════════════════════════════════════════════════════════╗');
      logger.info('║  Snow-Flow Enterprise MCP Server                       ║');
      logger.info('║  Version: 2.0.0                                        ║');
      logger.info('║                                                        ║');
      logger.info(`║  🌐 Server: http://0.0.0.0:${port}                      ║`);
      logger.info('║  🔌 SSE Endpoint: GET /mcp/sse                         ║');
      logger.info('║  📨 Messages: POST /mcp/messages                       ║');
      logger.info('║  ❤️  Health: GET /health                                ║');
      logger.info('║                                                        ║');
      logger.info(`║  🛠️  Tools: ${ENTERPRISE_TOOLS.length} enterprise tools                    ║`);
      logger.info('║    • Jira integration (8 tools)                        ║');
      logger.info('║    • Azure DevOps integration (10 tools)               ║');
      logger.info('║    • Confluence integration (8 tools)                  ║');
      logger.info('╚════════════════════════════════════════════════════════╝');
      logger.info('');
    });
  } catch (error) {
    logger.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  if (cleanupWorker) cleanupWorker.stop();
  if (db) await db.close();
  if (credsDb) await credsDb.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  if (cleanupWorker) cleanupWorker.stop();
  if (db) await db.close();
  if (credsDb) await credsDb.close();
  process.exit(0);
});

// Start the server
startServer();
