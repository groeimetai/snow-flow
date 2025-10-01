/**
 * snow_discover_uib_page_usage - Usage analytics
 *
 * Discovers usage analytics for UI Builder pages including
 * complexity scoring and recommendations.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_uib_page_usage',
  description: 'Discover usage analytics and complexity scoring for UI Builder pages',
  inputSchema: {
    type: 'object',
    properties: {
      page_id: {
        type: 'string',
        description: 'Page sys_id to analyze'
      },
      include_traffic: {
        type: 'boolean',
        description: 'Include page traffic metrics',
        default: false
      },
      include_complexity: {
        type: 'boolean',
        description: 'Include complexity analysis',
        default: true
      },
      time_period_days: {
        type: 'number',
        description: 'Analysis period in days',
        default: 30
      }
    },
    required: ['page_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    page_id,
    include_traffic = false,
    include_complexity = true,
    time_period_days = 30
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Get page details
    const pageResponse = await client.get(`/api/now/table/sys_ux_page/${page_id}`);
    const page = pageResponse.data.result;

    const usage: any = {
      page: {
        sys_id: page.sys_id,
        name: page.name,
        title: page.title
      }
    };

    if (include_complexity) {
      // Get page elements
      const elementsResponse = await client.get('/api/now/table/sys_ux_page_element', {
        params: { sysparm_query: `page=${page_id}` }
      });
      const elements = elementsResponse.data.result;

      // Get data brokers
      const brokersResponse = await client.get('/api/now/table/sys_ux_data_broker', {
        params: { sysparm_query: `page=${page_id}` }
      });
      const brokers = brokersResponse.data.result;

      // Get client scripts
      const scriptsResponse = await client.get('/api/now/table/sys_ux_client_script', {
        params: { sysparm_query: `page=${page_id}` }
      });
      const scripts = scriptsResponse.data.result;

      // Calculate complexity score
      const complexity = {
        total_elements: elements.length,
        total_data_brokers: brokers.length,
        total_client_scripts: scripts.length,
        complexity_score: (elements.length * 1) + (brokers.length * 2) + (scripts.length * 3),
        rating: 'low'
      };

      if (complexity.complexity_score > 50) complexity.rating = 'high';
      else if (complexity.complexity_score > 20) complexity.rating = 'medium';

      usage.complexity = complexity;
    }

    if (include_traffic) {
      usage.traffic = {
        note: 'Traffic metrics require integration with ServiceNow Performance Analytics',
        time_period_days
      };
    }

    return createSuccessResult(usage);

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
