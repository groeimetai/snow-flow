/**
 * MCP HTTP Server Router
 *
 * Remote MCP tool execution endpoint - serves all 43 enterprise tools
 * All tools require valid customer license key for authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { LicenseDatabase, Customer, CustomerInstance } from '../database/schema.js';
import {
  mcpRateLimiter,
  withTimeout,
  sanitizeError,
  redactSensitiveFields
} from '../middleware/security.js';
import { updateToolMetrics } from './monitoring.js';
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
} from '../integrations/azdo-tools.js';
import {
  confluenceSyncPages,
  confluenceGetPage,
  confluenceCreatePage,
  confluenceUpdatePage,
  confluenceSearchContent,
  confluenceGetSpace,
  confluenceCreateSpace,
  confluenceLinkPages
} from '../integrations/confluence-tools.js';

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
 *
 * Security: Requires authentication + rate limiting
 */
router.post('/tools/list', authenticateCustomer, mcpRateLimiter, trackInstance, async (req: Request, res: Response) => {
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
 *
 * Security: Requires authentication + rate limiting + execution timeout
 */
router.post('/tools/call', authenticateCustomer, mcpRateLimiter, trackInstance, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const customer = (req as any).customer as Customer;
  const instance = (req as any).instance as CustomerInstance;

  try {
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

    // Log tool execution (with redacted credentials)
    console.log(`[MCP] Executing tool: ${tool.name} for customer: ${customer.name}`, {
      customerId: customer.id,
      toolName: tool.name,
      category: tool.category,
      arguments: redactSensitiveFields(mcpRequest.arguments)
    });

    // Execute tool with 2-minute timeout
    const result = await withTimeout(
      tool.handler(
        mcpRequest.arguments,
        customer,
        mcpRequest.credentials || {}
      ),
      120000, // 2 minutes
      'Tool execution timeout (max 2 minutes)'
    );

    const duration = Date.now() - startTime;

    // Log successful execution to database for audit
    db.logMcpUsage({
      customerId: customer.id,
      instanceId: instance.id,
      toolName: tool.name,
      toolCategory: tool.category,
      timestamp: Date.now(),
      durationMs: duration,
      success: true,
      requestParams: JSON.stringify(redactSensitiveFields(mcpRequest.arguments)),
      ipAddress: req.ip
    });

    // Update metrics for monitoring
    if (typeof updateToolMetrics === 'function') {
      updateToolMetrics(tool.name, true, duration);
    }

    res.json({
      success: true,
      tool: tool.name,
      result,
      usage: {
        durationMs: duration,
        timestamp: startTime
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Log failed execution to database for audit
    db.logMcpUsage({
      customerId: customer.id,
      instanceId: instance?.id || 0,
      toolName: req.body.tool || 'unknown',
      toolCategory: 'unknown' as any,
      timestamp: Date.now(),
      durationMs: duration,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      requestParams: JSON.stringify(redactSensitiveFields(req.body.arguments || {})),
      ipAddress: req.ip
    });

    // Update metrics for monitoring
    if (typeof updateToolMetrics === 'function' && req.body.tool) {
      updateToolMetrics(req.body.tool, false, duration);
    }

    // Return sanitized error
    res.status(500).json(sanitizeError(error as Error));
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
  // Tool 1: Sync Work Items
  registerTool({
    name: 'snow_azdo_sync_work_items',
    description: 'Sync Azure DevOps work items to ServiceNow',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      states: { type: 'array', required: false, description: 'Work item states to sync' },
      workItemTypes: { type: 'array', required: false, description: 'Work item types (Bug, User Story, Task, etc.)' },
      areaPath: { type: 'string', required: false, description: 'Area path filter' },
      iterationPath: { type: 'string', required: false, description: 'Iteration/sprint filter' },
      maxResults: { type: 'number', required: false, default: 100, description: 'Max work items to sync' }
    },
    handler: azdoSyncWorkItems
  });

  // Tool 2: Get Work Item
  registerTool({
    name: 'snow_azdo_get_work_item',
    description: 'Get Azure DevOps work item with ServiceNow mapping',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      workItemId: { type: 'number', required: true, description: 'Work item ID' }
    },
    handler: azdoGetWorkItem
  });

  // Tool 3: Create Work Item
  registerTool({
    name: 'snow_azdo_create_work_item',
    description: 'Create new Azure DevOps work item',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      workItemType: { type: 'string', required: true, description: 'Work item type (Bug, User Story, Task, etc.)' },
      title: { type: 'string', required: true, description: 'Work item title' },
      description: { type: 'string', required: false, description: 'Work item description' },
      priority: { type: 'number', required: false, description: 'Priority (1-4)' },
      assignedTo: { type: 'string', required: false, description: 'Assigned user email' },
      tags: { type: 'string', required: false, description: 'Tags (semicolon separated)' },
      areaPath: { type: 'string', required: false, description: 'Area path' },
      iterationPath: { type: 'string', required: false, description: 'Iteration/sprint path' }
    },
    handler: azdoCreateWorkItem
  });

  // Tool 4: Update Work Item
  registerTool({
    name: 'snow_azdo_update_work_item',
    description: 'Update existing Azure DevOps work item',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      workItemId: { type: 'number', required: true, description: 'Work item ID to update' },
      title: { type: 'string', required: false, description: 'New title' },
      description: { type: 'string', required: false, description: 'New description' },
      state: { type: 'string', required: false, description: 'New state (New, Active, Resolved, Closed, etc.)' },
      priority: { type: 'number', required: false, description: 'New priority (1-4)' },
      assignedTo: { type: 'string', required: false, description: 'New assignee email' },
      tags: { type: 'string', required: false, description: 'New tags' }
    },
    handler: azdoUpdateWorkItem
  });

  // Tool 5: Get Pipeline Runs
  registerTool({
    name: 'snow_azdo_get_pipeline_runs',
    description: 'Get Azure DevOps pipeline build runs',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      pipelineId: { type: 'number', required: false, description: 'Specific pipeline ID' },
      branch: { type: 'string', required: false, description: 'Filter by branch' },
      status: { type: 'string', required: false, description: 'Filter by status (inProgress, completed, etc.)' },
      maxResults: { type: 'number', required: false, default: 50, description: 'Max runs to return' }
    },
    handler: azdoGetPipelineRuns
  });

  // Tool 6: Trigger Pipeline
  registerTool({
    name: 'snow_azdo_trigger_pipeline',
    description: 'Trigger Azure DevOps pipeline build',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      pipelineId: { type: 'number', required: true, description: 'Pipeline ID to trigger' },
      branch: { type: 'string', required: true, description: 'Branch to build' },
      parameters: { type: 'object', required: false, description: 'Build parameters' }
    },
    handler: azdoTriggerPipeline
  });

  // Tool 7: Get Pull Requests
  registerTool({
    name: 'snow_azdo_get_pull_requests',
    description: 'Get Azure DevOps pull requests',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      repositoryId: { type: 'string', required: true, description: 'Repository ID or name' },
      status: { type: 'string', required: false, description: 'PR status (active, completed, abandoned)' },
      creatorId: { type: 'string', required: false, description: 'Filter by creator' },
      maxResults: { type: 'number', required: false, default: 50, description: 'Max PRs to return' }
    },
    handler: azdoGetPullRequests
  });

  // Tool 8: Create Pull Request
  registerTool({
    name: 'snow_azdo_create_pull_request',
    description: 'Create Azure DevOps pull request',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      repositoryId: { type: 'string', required: true, description: 'Repository ID or name' },
      sourceBranch: { type: 'string', required: true, description: 'Source branch name' },
      targetBranch: { type: 'string', required: true, description: 'Target branch name' },
      title: { type: 'string', required: true, description: 'PR title' },
      description: { type: 'string', required: false, description: 'PR description' }
    },
    handler: azdoCreatePullRequest
  });

  // Tool 9: Get Releases
  registerTool({
    name: 'snow_azdo_get_releases',
    description: 'Get Azure DevOps releases',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      definitionId: { type: 'number', required: false, description: 'Release definition ID' },
      maxResults: { type: 'number', required: false, default: 50, description: 'Max releases to return' }
    },
    handler: azdoGetReleases
  });

  // Tool 10: Create Release
  registerTool({
    name: 'snow_azdo_create_release',
    description: 'Create Azure DevOps release',
    category: 'azdo',
    inputSchema: {
      organization: { type: 'string', required: true, description: 'Azure DevOps organization' },
      project: { type: 'string', required: true, description: 'Project name' },
      definitionId: { type: 'number', required: true, description: 'Release definition ID' },
      description: { type: 'string', required: false, description: 'Release description' },
      artifacts: { type: 'array', required: false, description: 'Build artifacts to deploy' }
    },
    handler: azdoCreateRelease
  });

  console.log('[MCP] Registered 10 Azure DevOps tools (fully implemented)');
}

/**
 * Register Confluence integration tools
 */
function registerConfluenceTools() {
  // Tool 1: Sync Pages
  registerTool({
    name: 'snow_confluence_sync_pages',
    description: 'Sync Confluence pages to ServiceNow knowledge base',
    category: 'confluence',
    inputSchema: {
      spaceKey: { type: 'string', required: true, description: 'Confluence space key' },
      limit: { type: 'number', required: false, default: 100, description: 'Max pages to sync' },
      titleFilter: { type: 'string', required: false, description: 'Filter pages by title substring' }
    },
    handler: confluenceSyncPages
  });

  // Tool 2: Get Page
  registerTool({
    name: 'snow_confluence_get_page',
    description: 'Get Confluence page with ServiceNow mapping',
    category: 'confluence',
    inputSchema: {
      pageId: { type: 'string', required: true, description: 'Page ID' }
    },
    handler: confluenceGetPage
  });

  // Tool 3: Create Page
  registerTool({
    name: 'snow_confluence_create_page',
    description: 'Create new Confluence page',
    category: 'confluence',
    inputSchema: {
      spaceKey: { type: 'string', required: true, description: 'Space key' },
      title: { type: 'string', required: true, description: 'Page title' },
      content: { type: 'string', required: true, description: 'Page content (HTML/Storage format)' },
      parentId: { type: 'string', required: false, description: 'Parent page ID' }
    },
    handler: confluenceCreatePage
  });

  // Tool 4: Update Page
  registerTool({
    name: 'snow_confluence_update_page',
    description: 'Update existing Confluence page',
    category: 'confluence',
    inputSchema: {
      pageId: { type: 'string', required: true, description: 'Page ID' },
      title: { type: 'string', required: false, description: 'New page title' },
      content: { type: 'string', required: false, description: 'New page content (HTML/Storage format)' }
    },
    handler: confluenceUpdatePage
  });

  // Tool 5: Search Content
  registerTool({
    name: 'snow_confluence_search',
    description: 'Search Confluence content using CQL',
    category: 'confluence',
    inputSchema: {
      query: { type: 'string', required: true, description: 'Search query text' },
      spaceKey: { type: 'string', required: false, description: 'Limit search to specific space' },
      type: { type: 'string', required: false, default: 'page', description: 'Content type (page, blogpost, etc.)' },
      limit: { type: 'number', required: false, default: 25, description: 'Max results' }
    },
    handler: confluenceSearchContent
  });

  // Tool 6: Get Space
  registerTool({
    name: 'snow_confluence_get_space',
    description: 'Get Confluence space details',
    category: 'confluence',
    inputSchema: {
      spaceKey: { type: 'string', required: true, description: 'Space key' }
    },
    handler: confluenceGetSpace
  });

  // Tool 7: Create Space
  registerTool({
    name: 'snow_confluence_create_space',
    description: 'Create new Confluence space',
    category: 'confluence',
    inputSchema: {
      key: { type: 'string', required: true, description: 'Space key (uppercase, no spaces)' },
      name: { type: 'string', required: true, description: 'Space name' },
      description: { type: 'string', required: false, description: 'Space description' }
    },
    handler: confluenceCreateSpace
  });

  // Tool 8: Link Pages
  registerTool({
    name: 'snow_confluence_link_pages',
    description: 'Create link between two Confluence pages',
    category: 'confluence',
    inputSchema: {
      sourcePageId: { type: 'string', required: true, description: 'Source page ID' },
      targetPageId: { type: 'string', required: true, description: 'Target page ID to link to' }
    },
    handler: confluenceLinkPages
  });

  console.log('[MCP] Registered 8 Confluence tools (fully implemented)');
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
