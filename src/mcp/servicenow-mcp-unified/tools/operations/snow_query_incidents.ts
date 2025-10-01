/**
 * snow_query_incidents - Query incidents
 *
 * Query incidents with advanced filtering and analysis capabilities.
 * Optimized for performance with optional content inclusion.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_query_incidents',
  description: 'Query incidents with advanced filtering and analysis capabilities. Optimized for performance with optional content inclusion.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'ServiceNow encoded query or natural language description (e.g., "high priority", "open", "active=true^priority=1")'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
        minimum: 1,
        maximum: 1000
      },
      include_content: {
        type: 'boolean',
        description: 'Include full incident data. Default false for performance, returns count and summary only.',
        default: false
      },
      include_analysis: {
        type: 'boolean',
        description: 'Include intelligent analysis of incidents (requires include_content=true)',
        default: false
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific fields to return (automatically sets include_content=true)',
        examples: [['number', 'short_description', 'priority', 'state']]
      }
    },
    required: ['query']
  }
};

function processNaturalLanguageQuery(query: string): string {
  const lowerQuery = query.toLowerCase();

  // If already a ServiceNow encoded query, return as-is
  if (query.includes('=') || query.includes('!=') || query.includes('^') || query.includes('LIKE')) {
    return query;
  }

  // Common patterns
  if (lowerQuery.includes('high priority')) return 'priority=1';
  if (lowerQuery.includes('critical')) return 'priority=1^ORseverity=1';
  if (lowerQuery.includes('open') || lowerQuery.includes('active')) return 'active=true^state!=6^state!=7';
  if (lowerQuery.includes('closed') || lowerQuery.includes('resolved')) return 'state=6^ORstate=7';
  if (lowerQuery.includes('today')) return 'sys_created_onONToday@javascript:gs.daysAgoStart(0)@javascript:gs.daysAgoEnd(0)';
  if (lowerQuery.includes('all') || lowerQuery === '') return '';

  // Default: search in short_description
  return `short_descriptionLIKE${query}^ORdescriptionLIKE${query}`;
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    query,
    limit = 10,
    include_content = false,
    include_analysis = false,
    fields
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Process query
    const processedQuery = processNaturalLanguageQuery(query);

    // Build params
    const params: any = {
      sysparm_query: processedQuery,
      sysparm_limit: limit
    };

    if (fields && fields.length > 0) {
      params.sysparm_fields = fields.join(',');
    }

    // Execute query
    const response = await client.get('/api/now/table/incident', { params });
    const incidents = response.data.result || [];

    let result: any = {
      total_results: incidents.length,
      query_used: processedQuery
    };

    // Include content if requested or fields specified
    if (include_content || (fields && fields.length > 0)) {
      result.incidents = incidents;
    } else {
      // Performance mode: summary only
      result.summary = {
        count: incidents.length,
        message: 'Use include_content=true to retrieve full incident data'
      };

      if (incidents.length > 0) {
        result.summary.sample = {
          first_incident: incidents[0].number || 'Unknown',
          categories: [...new Set(incidents.slice(0, 5).map((inc: any) => inc.category || 'none'))],
          priorities: [...new Set(incidents.slice(0, 5).map((inc: any) => inc.priority || 'none'))],
          states: [...new Set(incidents.slice(0, 5).map((inc: any) => inc.state || 'unknown'))]
        };
      }
    }

    // Add analysis if requested
    if (include_analysis && incidents.length > 0) {
      const patterns = new Map<string, number>();
      const categories = new Map<string, number>();

      incidents.forEach((incident: any) => {
        const category = incident.category || 'uncategorized';
        categories.set(category, (categories.get(category) || 0) + 1);

        const description = (incident.short_description || '').toLowerCase();
        if (description.includes('network')) patterns.set('network_issues', (patterns.get('network_issues') || 0) + 1);
        if (description.includes('database')) patterns.set('database_issues', (patterns.get('database_issues') || 0) + 1);
        if (description.includes('password')) patterns.set('auth_issues', (patterns.get('auth_issues') || 0) + 1);
      });

      result.analysis = {
        patterns_detected: Object.fromEntries(patterns),
        category_distribution: Object.fromEntries(categories),
        total_analyzed: incidents.length
      };
    }

    return createSuccessResult(
      result,
      { query: processedQuery, limit, count: incidents.length }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
