/**
 * MCP HTTP Server Router
 *
 * Remote MCP tool execution endpoint - serves all 43 enterprise tools
 * All tools require valid customer license key for authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { LicenseDatabase, Customer, CustomerInstance } from '../database/schema.js';
import {
  jiraSyncBacklog,
  jiraGetIssue,
  jiraCreateIssue,
  jiraUpdateIssue,
  jiraTransitionIssue,
  jiraSearchIssues,
  jiraGetProject,
  jiraLinkIssues
} from '../integrations/jira-tools.js';

const router = Router();
const db = new LicenseDatabase();

// ===== TYPES =====

interface McpToolDefinition {
  name: string;
  description: string;
  category: 'jira' | 'azdo' | 'confluence' | 'ml' | 'sso';
  inputSchema: Record<string, any>;
  handler: (args: any, customer: Customer, credentials: any) => Promise<any>;
}

interface McpRequest {
  tool: string;
  arguments: Record<string, any>;
  credentials?: {
    jira?: {
      host: string;
      email: string;
      apiToken: string;
    };
    azureDevOps?: {
      organization: string;
      pat: string;
    };
    confluence?: {
      host: string;
      email: string;
      apiToken: string;
    };
  };
}

// ===== MIDDLEWARE =====

/**
 * Authenticate MCP requests with customer license key
 */
async function authenticateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const licenseKey = req.headers['authorization']?.replace('Bearer ', '');

    if (!licenseKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing license key - provide in Authorization header'
      });
    }

    // Validate license key format
    if (!licenseKey.match(/^SNOW-ENT-[A-Z0-9]+-[A-Z0-9]+$/)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid license key format'
      });
    }

    // Get customer from database
    const customer = db.getCustomer(licenseKey);

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: 'Invalid license key'
      });
    }

    // Check customer status
    if (customer.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Customer status: ${customer.status} - contact support`
      });
    }

    // Store customer in request for later use
    (req as any).customer = customer;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Track instance and update last seen
 */
async function trackInstance(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = (req as any).customer as Customer;
    const instanceId = req.headers['x-instance-id'] as string;
    const version = req.headers['x-snow-flow-version'] as string || '8.2.0';
    const hostname = req.hostname;
    const ipAddress = req.ip;

    if (instanceId) {
      // Upsert instance
      db.upsertCustomerInstance(
        customer.id,
        instanceId,
        version,
        ipAddress,
        hostname
      );
    }

    next();
  } catch (error) {
    console.error('Instance tracking error:', error);
    // Don't fail request, just log error
    next();
  }
}

/**
 * Log MCP tool usage
 */
function createUsageLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const customer = (req as any).customer as Customer;

    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const mcpRequest = req.body as McpRequest;

        // Get instance ID
        const instanceId = req.headers['x-instance-id'] as string;
        let instanceDbId: number | undefined;

        if (instanceId) {
          const instances = db.listCustomerInstances(customer.id);
          const instance = instances.find(i => i.instanceId === instanceId);
          instanceDbId = instance?.id;
        }

        // Determine tool category
        const toolName = mcpRequest.tool;
        let category: 'jira' | 'azdo' | 'confluence' | 'ml' | 'sso' = 'jira';

        if (toolName.startsWith('snow_jira_')) category = 'jira';
        else if (toolName.startsWith('snow_azdo_')) category = 'azdo';
        else if (toolName.startsWith('snow_confluence_')) category = 'confluence';
        else if (toolName.startsWith('snow_ml_') || toolName.startsWith('snow_analytics_')) category = 'ml';
        else if (toolName.includes('sso') || toolName.includes('saml')) category = 'sso';

        // Log usage
        db.logMcpUsage({
          customerId: customer.id,
          instanceId: instanceDbId || 0,
          toolName,
          toolCategory: category,
          timestamp: startTime,
          durationMs: duration,
          success: res.statusCode < 400,
          errorMessage: res.statusCode >= 400 ? res.statusMessage : undefined,
          requestParams: JSON.stringify(mcpRequest.arguments).substring(0, 1000), // Limit to 1KB
          ipAddress: req.ip
        });

        // Increment customer API call counter
        db.incrementCustomerApiCalls(customer.id);

      } catch (error) {
        console.error('Usage logging error:', error);
      }
    });

    next();
  };
}

// Apply middleware to all MCP routes
router.use(authenticateCustomer);
router.use(trackInstance);
router.use(createUsageLogger());

// ===== MCP TOOL REGISTRY =====

const mcpTools = new Map<string, McpToolDefinition>();

/**
 * Register an MCP tool
 */
function registerTool(tool: McpToolDefinition) {
  mcpTools.set(tool.name, tool);
  console.log(`[MCP] Registered tool: ${tool.name} (${tool.category})`);
}

/**
 * Get tool by name
 */
function getTool(name: string): McpToolDefinition | undefined {
  return mcpTools.get(name);
}

// ===== MCP ENDPOINTS =====

/**
 * POST /mcp/tools/list
 * List all available MCP tools
 */
router.post('/tools/list', async (req: Request, res: Response) => {
  try {
    const customer = (req as any).customer as Customer;

    // Get all tools
    const tools = Array.from(mcpTools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      inputSchema: tool.inputSchema
    }));

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        licenseKey: customer.licenseKey
      },
      tools,
      count: tools.length
    });
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list tools'
    });
  }
});

/**
 * POST /mcp/tools/call
 * Execute an MCP tool
 */
router.post('/tools/call', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const customer = (req as any).customer as Customer;
    const mcpRequest = req.body as McpRequest;

    // Validate request
    if (!mcpRequest.tool) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tool'
      });
    }

    if (!mcpRequest.arguments) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: arguments'
      });
    }

    // Get tool
    const tool = getTool(mcpRequest.tool);

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: `Tool not found: ${mcpRequest.tool}`,
        availableTools: Array.from(mcpTools.keys())
      });
    }

    // Execute tool
    console.log(`[MCP] Executing tool: ${tool.name} for customer: ${customer.name}`);

    const result = await tool.handler(
      mcpRequest.arguments,
      customer,
      mcpRequest.credentials || {}
    );

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      tool: tool.name,
      result,
      usage: {
        durationMs: duration,
        timestamp: startTime,
        customer: customer.name
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Tool execution error:', error);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
      usage: {
        durationMs: duration,
        timestamp: startTime
      }
    });
  }
});

/**
 * POST /mcp/tools/{toolName}
 * Direct tool execution endpoint (alternative to /call)
 */
router.post('/tools/:toolName', async (req: Request, res: Response) => {
  // Redirect to /call endpoint
  req.body = {
    tool: req.params.toolName,
    arguments: req.body.arguments || req.body,
    credentials: req.body.credentials
  };

  // Call the /call handler
  return router.stack.find(layer => layer.route?.path === '/tools/call')
    ?.route?.stack[0]?.handle(req, res, () => {});
});

// ===== TOOL IMPLEMENTATIONS =====

/**
 * Register all MCP tools
 */
function registerAllTools() {
  console.log('[MCP] Registering enterprise tools...');

  // JIRA TOOLS (8 tools)
  registerJiraTools();

  // AZURE DEVOPS TOOLS (10 tools)
  registerAzureDevOpsTools();

  // CONFLUENCE TOOLS (8 tools)
  registerConfluenceTools();

  // ML & ANALYTICS TOOLS (15 tools)
  registerMlTools();

  // SSO/SAML TOOLS (2 tools)
  registerSsoTools();

  console.log(`[MCP] Total tools registered: ${mcpTools.size}`);
}

/**
 * Register Jira integration tools
 */
function registerJiraTools() {
  // Tool 1: Sync Backlog
  registerTool({
    name: 'snow_jira_sync_backlog',
    description: 'Sync Jira backlog to ServiceNow incidents/tasks',
    category: 'jira',
    inputSchema: {
      projectKey: { type: 'string', required: true, description: 'Jira project key (e.g., PROJ)' },
      sprint: { type: 'string', required: false, description: 'Sprint name to filter by' },
      status: { type: 'array', required: false, description: 'Status names to filter by' },
      issueTypes: { type: 'array', required: false, description: 'Issue types to sync (Story, Bug, etc.)' },
      syncToTable: { type: 'string', required: false, default: 'incident', description: 'ServiceNow table' },
      maxResults: { type: 'number', required: false, default: 100, description: 'Max issues to sync' }
    },
    handler: jiraSyncBacklog
  });

  // Tool 2: Get Issue
  registerTool({
    name: 'snow_jira_get_issue',
    description: 'Get detailed Jira issue information with ServiceNow mapping',
    category: 'jira',
    inputSchema: {
      issueKey: { type: 'string', required: true, description: 'Jira issue key (e.g., PROJ-123)' }
    },
    handler: jiraGetIssue
  });

  // Tool 3: Create Issue
  registerTool({
    name: 'snow_jira_create_issue',
    description: 'Create a new Jira issue',
    category: 'jira',
    inputSchema: {
      projectKey: { type: 'string', required: true, description: 'Project key' },
      summary: { type: 'string', required: true, description: 'Issue summary' },
      description: { type: 'string', required: false, description: 'Issue description' },
      issueType: { type: 'string', required: true, description: 'Issue type (Story, Bug, Task, etc.)' },
      priority: { type: 'string', required: false, description: 'Priority name (Highest, High, Medium, Low, Lowest)' },
      assignee: { type: 'string', required: false, description: 'Assignee account ID' },
      labels: { type: 'array', required: false, description: 'Issue labels' },
      components: { type: 'array', required: false, description: 'Component names' },
      customFields: { type: 'object', required: false, description: 'Custom field values' }
    },
    handler: jiraCreateIssue
  });

  // Tool 4: Update Issue
  registerTool({
    name: 'snow_jira_update_issue',
    description: 'Update an existing Jira issue',
    category: 'jira',
    inputSchema: {
      issueKey: { type: 'string', required: true, description: 'Issue key to update' },
      summary: { type: 'string', required: false, description: 'New summary' },
      description: { type: 'string', required: false, description: 'New description' },
      priority: { type: 'string', required: false, description: 'New priority' },
      assignee: { type: 'string', required: false, description: 'New assignee account ID' },
      labels: { type: 'array', required: false, description: 'New labels' },
      customFields: { type: 'object', required: false, description: 'Custom field updates' }
    },
    handler: jiraUpdateIssue
  });

  // Tool 5: Transition Issue
  registerTool({
    name: 'snow_jira_transition_issue',
    description: 'Transition Jira issue to a new status',
    category: 'jira',
    inputSchema: {
      issueKey: { type: 'string', required: true, description: 'Issue key to transition' },
      transitionIdOrName: { type: 'string', required: true, description: 'Transition ID or name' },
      comment: { type: 'string', required: false, description: 'Optional comment' },
      fields: { type: 'object', required: false, description: 'Fields to set during transition' }
    },
    handler: jiraTransitionIssue
  });

  // Tool 6: Search Issues
  registerTool({
    name: 'snow_jira_search_issues',
    description: 'Search Jira issues with JQL',
    category: 'jira',
    inputSchema: {
      jql: { type: 'string', required: true, description: 'JQL query string' },
      maxResults: { type: 'number', required: false, default: 100, description: 'Max results to return' },
      startAt: { type: 'number', required: false, default: 0, description: 'Starting index for pagination' },
      fields: { type: 'array', required: false, description: 'Fields to return' }
    },
    handler: jiraSearchIssues
  });

  // Tool 7: Get Project
  registerTool({
    name: 'snow_jira_get_project',
    description: 'Get Jira project details',
    category: 'jira',
    inputSchema: {
      projectKey: { type: 'string', required: true, description: 'Project key' }
    },
    handler: jiraGetProject
  });

  // Tool 8: Link Issues
  registerTool({
    name: 'snow_jira_link_issues',
    description: 'Create a link between two Jira issues',
    category: 'jira',
    inputSchema: {
      inwardIssueKey: { type: 'string', required: true, description: 'Inward issue key' },
      outwardIssueKey: { type: 'string', required: true, description: 'Outward issue key' },
      linkType: { type: 'string', required: true, description: 'Link type (Blocks, Relates, etc.)' }
    },
    handler: jiraLinkIssues
  });

  console.log('[MCP] Registered 8 Jira tools (fully implemented)');
}

/**
 * Register Azure DevOps integration tools
 */
function registerAzureDevOpsTools() {
  const azdoTools = [
    'snow_azdo_sync_work_items',
    'snow_azdo_get_work_item',
    'snow_azdo_create_work_item',
    'snow_azdo_update_work_item',
    'snow_azdo_get_pipeline_runs',
    'snow_azdo_trigger_pipeline',
    'snow_azdo_get_pull_requests',
    'snow_azdo_create_pull_request',
    'snow_azdo_get_releases',
    'snow_azdo_create_release'
  ];

  azdoTools.forEach(toolName => {
    registerTool({
      name: toolName,
      description: `${toolName.replace('snow_azdo_', '').replace(/_/g, ' ')} - Azure DevOps integration`,
      category: 'azdo',
      inputSchema: {
        organization: { type: 'string', required: true },
        project: { type: 'string', required: true }
      },
      handler: async (args, customer, credentials) => {
        return {
          message: `${toolName} - implementation coming soon`,
          organization: args.organization,
          project: args.project,
          customer: customer.name
        };
      }
    });
  });

  console.log('[MCP] Registered 10 Azure DevOps tools');
}

/**
 * Register Confluence integration tools
 */
function registerConfluenceTools() {
  const confluenceTools = [
    'snow_confluence_sync_pages',
    'snow_confluence_get_page',
    'snow_confluence_create_page',
    'snow_confluence_update_page',
    'snow_confluence_search',
    'snow_confluence_get_space',
    'snow_confluence_attach_file',
    'snow_confluence_export_page'
  ];

  confluenceTools.forEach(toolName => {
    registerTool({
      name: toolName,
      description: `${toolName.replace('snow_confluence_', '').replace(/_/g, ' ')} - Confluence integration`,
      category: 'confluence',
      inputSchema: {
        spaceKey: { type: 'string', required: false }
      },
      handler: async (args, customer, credentials) => {
        return {
          message: `${toolName} - implementation coming soon`,
          customer: customer.name
        };
      }
    });
  });

  console.log('[MCP] Registered 8 Confluence tools');
}

/**
 * Register ML & Analytics tools
 */
function registerMlTools() {
  const mlTools = [
    'snow_ml_predict_incident_priority',
    'snow_ml_predict_incident_category',
    'snow_ml_predict_assignment_group',
    'snow_ml_detect_duplicate_incidents',
    'snow_ml_predict_resolution_time',
    'snow_ml_recommend_solutions',
    'snow_ml_detect_anomalies',
    'snow_ml_forecast_incident_volume',
    'snow_ml_cluster_similar_issues',
    'snow_ml_sentiment_analysis',
    'snow_analytics_incident_trends',
    'snow_analytics_sla_performance',
    'snow_analytics_agent_performance',
    'snow_analytics_change_success_rate',
    'snow_analytics_custom_report'
  ];

  mlTools.forEach(toolName => {
    registerTool({
      name: toolName,
      description: `${toolName.replace('snow_ml_', '').replace('snow_analytics_', '').replace(/_/g, ' ')} - ML/Analytics`,
      category: 'ml',
      inputSchema: {},
      handler: async (args, customer, credentials) => {
        return {
          message: `${toolName} - implementation coming soon`,
          customer: customer.name
        };
      }
    });
  });

  console.log('[MCP] Registered 15 ML/Analytics tools');
}

/**
 * Register SSO/SAML tools
 */
function registerSsoTools() {
  registerTool({
    name: 'snow_configure_sso',
    description: 'Configure SSO for ServiceNow instance',
    category: 'sso',
    inputSchema: {
      provider: { type: 'string', required: true },
      idpMetadata: { type: 'string', required: true }
    },
    handler: async (args, customer, credentials) => {
      return {
        message: 'SSO configuration - implementation coming soon',
        provider: args.provider,
        customer: customer.name
      };
    }
  });

  registerTool({
    name: 'snow_configure_saml',
    description: 'Configure SAML 2.0 authentication',
    category: 'sso',
    inputSchema: {
      idpCertificate: { type: 'string', required: true },
      ssoUrl: { type: 'string', required: true }
    },
    handler: async (args, customer, credentials) => {
      return {
        message: 'SAML configuration - implementation coming soon',
        customer: customer.name
      };
    }
  });

  console.log('[MCP] Registered 2 SSO/SAML tools');
}

// Register all tools on module load
registerAllTools();

export { router as mcpRouter, registerTool, getTool };
