/**
 * Meta-Tools for Lazy Loading Mode
 *
 * When SNOW_LAZY_TOOLS=true, only these 2 tools are registered in tools/list.
 * This reduces token usage from ~71k to ~2k while keeping all functionality available.
 *
 * Workflow:
 * 1. AI calls tool_search({query: "incidents"})
 * 2. Returns list of matching tools with their schemas
 * 3. AI calls tool_execute({tool: "snow_query_incidents", args: {...}})
 * 4. Tool is executed and result returned
 *
 * @see https://www.anthropic.com/engineering/advanced-tool-use
 */

import { MCPToolDefinition, ServiceNowContext } from '../../shared/types.js';
import { toolRegistry } from '../../shared/tool-registry.js';

// ============================================================================
// tool_search - Search for available tools
// ============================================================================

export const tool_search_def: MCPToolDefinition = {
  name: 'tool_search',
  description: `Search for available ServiceNow tools when you need specialized functionality.

This tool searches through ALL 235+ available tools including:
- Core operations (queries, CRUD, bulk operations)
- Deployment (widgets, UI pages, script includes)
- CMDB and asset management
- Change/incident/problem management
- Knowledge base and service catalog
- Automation (scripts, scheduled jobs, events)
- Security (ACLs, policies, compliance)
- Reporting (dashboards, KPIs, reports)
- And many more specialized tools

IMPORTANT: After searching, use tool_execute to call the found tools.

Example workflow:
1. tool_search({query: "incident query"})
   → Returns: snow_query_incidents, snow_query_table, ...
2. tool_execute({tool: "snow_query_incidents", args: {query: "priority=1"}})
   → Executes the tool and returns results`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to find relevant tools. Examples: "incident", "widget deploy", "cmdb", "update set", "knowledge article", "change request"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
        default: 10
      }
    },
    required: ['query']
  }
};

export async function tool_search_exec(
  args: { query: string; limit?: number },
  context: ServiceNowContext
): Promise<any> {
  const query = args.query.toLowerCase();
  const limit = args.limit || 10;
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);

  // Get all tools from registry
  const allTools = toolRegistry.getToolDefinitions();

  // Score each tool based on query match
  const scored = allTools.map(tool => {
    let score = 0;
    const nameLower = tool.name.toLowerCase();
    const descLower = tool.description.toLowerCase();

    // Exact name match (highest priority)
    if (nameLower === query) score += 100;

    // Name contains query
    if (nameLower.includes(query)) score += 50;

    // Name starts with snow_ + query part
    const queryPart = query.replace(/^snow_?/, '');
    if (nameLower.includes(queryPart)) score += 40;

    // Description contains query
    if (descLower.includes(query)) score += 20;

    // Word-level matching
    for (const word of queryWords) {
      if (nameLower.includes(word)) score += 15;
      if (descLower.includes(word)) score += 5;
    }

    // Domain matching from tool registry
    const registeredTool = toolRegistry.getTool(tool.name);
    if (registeredTool && registeredTool.domain.toLowerCase().includes(query)) {
      score += 30;
    }

    return { tool, score, domain: registeredTool?.domain || 'unknown' };
  });

  // Filter and sort by score
  const results = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (results.length === 0) {
    // Get available domains for suggestion
    const domains = toolRegistry.getAvailableDomains().slice(0, 15);
    return {
      success: false,
      message: `No tools found matching "${args.query}"`,
      suggestion: `Try different keywords. Available domains: ${domains.join(', ')}`,
      available_domains: domains
    };
  }

  // Format results with schema info
  const formattedTools = results.map((r, i) => {
    const params = r.tool.inputSchema?.properties || {};
    const required = r.tool.inputSchema?.required || [];

    const paramList = Object.entries(params).map(([name, prop]: [string, any]) => {
      const isRequired = required.includes(name);
      const type = prop.type || 'any';
      return `    ${isRequired ? '*' : ''}${name}: ${type}${prop.description ? ` - ${prop.description.substring(0, 80)}` : ''}`;
    });

    return {
      rank: i + 1,
      name: r.tool.name,
      domain: r.domain,
      description: r.tool.description.substring(0, 200) + (r.tool.description.length > 200 ? '...' : ''),
      parameters: paramList.length > 0 ? paramList.slice(0, 5) : ['(no parameters)'],
      has_more_params: paramList.length > 5
    };
  });

  return {
    success: true,
    query: args.query,
    count: results.length,
    tools: formattedTools,
    usage_hint: `To use a tool, call: tool_execute({tool: "${results[0]?.tool.name}", args: {...}})`
  };
}

// ============================================================================
// tool_execute - Execute any tool by name
// ============================================================================

export const tool_execute_def: MCPToolDefinition = {
  name: 'tool_execute',
  description: `Execute any ServiceNow tool by name. Use this after tool_search to call the tools you found.

This is the gateway to ALL 235+ ServiceNow tools. After searching with tool_search,
use this tool to execute the found tools.

Example:
1. tool_search({query: "query incidents"})
   → Found: snow_query_incidents
2. tool_execute({
     tool: "snow_query_incidents",
     args: { query: "priority=1^state!=7", limit: 10 }
   })
   → Returns the query results

The 'args' parameter should match the tool's input schema from tool_search results.`,
  inputSchema: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        description: 'The exact tool name to execute (from tool_search results)'
      },
      args: {
        type: 'object',
        description: 'Arguments to pass to the tool (must match tool\'s input schema)',
        additionalProperties: true
      }
    },
    required: ['tool', 'args']
  }
};

export async function tool_execute_exec(
  args: { tool: string; args: Record<string, any> },
  context: ServiceNowContext
): Promise<any> {
  const toolName = args.tool;
  const toolArgs = args.args || {};

  // Get tool from registry
  const tool = toolRegistry.getTool(toolName);

  if (!tool) {
    // Try to find similar tools
    const allTools = toolRegistry.getToolDefinitions();
    const similar = allTools
      .filter(t => t.name.includes(toolName) || toolName.includes(t.name.replace('snow_', '')))
      .slice(0, 5)
      .map(t => t.name);

    return {
      success: false,
      error: `Tool not found: ${toolName}`,
      suggestion: similar.length > 0
        ? `Did you mean one of these? ${similar.join(', ')}`
        : 'Use tool_search to find available tools',
      hint: 'Use tool_search({query: "your task"}) to find the right tool'
    };
  }

  // Execute the tool
  try {
    console.error(`[MetaTool] Executing via tool_execute: ${toolName}`);
    const result = await tool.executor(toolArgs, context);
    return {
      success: true,
      tool: toolName,
      result
    };
  } catch (error: any) {
    return {
      success: false,
      tool: toolName,
      error: error.message,
      hint: 'Check tool_search results for correct parameter format'
    };
  }
}

// ============================================================================
// Export meta-tools array for easy registration
// ============================================================================

export const META_TOOLS = [
  { definition: tool_search_def, executor: tool_search_exec },
  { definition: tool_execute_def, executor: tool_execute_exec }
];
