/**
 * snow_query_problems - Query problems
 *
 * Queries problem records with root cause analysis and optional inclusion of related incidents.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_query_problems',
  description: 'Queries problem records with root cause analysis and optional inclusion of related incidents',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'operations',
  use_cases: ['problems', 'query'],
  complexity: 'intermediate',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'ServiceNow encoded query or natural language (e.g., "open", "active=true", "high priority")'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
        minimum: 1,
        maximum: 100
      },
      include_incidents: {
        type: 'boolean',
        description: 'Include related incidents for each problem',
        default: false
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
  if (lowerQuery.includes('open') || lowerQuery.includes('active')) return 'active=true^state!=4';
  if (lowerQuery.includes('closed') || lowerQuery.includes('resolved')) return 'state=4';
  if (lowerQuery.includes('high priority')) return 'priority=1';
  if (lowerQuery.includes('all') || lowerQuery === '') return '';

  // Default: search in short_description
  return `short_descriptionLIKE${query}`;
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { query, limit = 10, include_incidents = false } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Process query
    const processedQuery = processNaturalLanguageQuery(query);

    // Query problems
    const response = await client.get('/api/now/table/problem', {
      params: {
        sysparm_query: processedQuery,
        sysparm_limit: limit
      }
    });

    const problems = response.data.result || [];

    let result: any = {
      total_results: problems.length,
      query_used: processedQuery,
      problems: problems.map((problem: any) => ({
        number: problem.number,
        sys_id: problem.sys_id,
        short_description: problem.short_description,
        state: problem.state,
        priority: problem.priority,
        root_cause: problem.problem_statement,
        known_error: problem.known_error
      }))
    };

    // Include related incidents if requested
    if (include_incidents && problems.length > 0) {
      const relatedIncidents = [];

      for (const problem of problems) {
        const incidentResponse = await client.get('/api/now/table/incident', {
          params: {
            sysparm_query: `problem_id=${problem.sys_id}`,
            sysparm_limit: 10
          }
        });

        if (incidentResponse.data.result && incidentResponse.data.result.length > 0) {
          relatedIncidents.push({
            problem_number: problem.number,
            incident_count: incidentResponse.data.result.length,
            incidents: incidentResponse.data.result.map((inc: any) => ({
              number: inc.number,
              short_description: inc.short_description,
              state: inc.state
            }))
          });
        }
      }

      result.related_incidents = relatedIncidents;
    }

    return createSuccessResult(
      result,
      { query: processedQuery, limit, count: problems.length }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
