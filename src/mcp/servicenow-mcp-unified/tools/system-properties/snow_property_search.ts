/**
 * Search properties by name or value content
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const schema = z.object({
  search_term: z.string().describe('Search term to find in property names or values'),
  search_in: z.enum(['name', 'value', 'description', 'all']).optional().default('all').describe('Where to search'),
  limit: z.number().optional().default(50).describe('Maximum results'),
});

export async function snow_property_search(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_search');

  try {
    logger.info(`Searching properties for: ${params.search_term}`);

    let query = '';
    switch (params.search_in) {
      case 'name':
        query = `nameLIKE${params.search_term}`;
        break;
      case 'value':
        query = `valueLIKE${params.search_term}`;
        break;
      case 'description':
        query = `descriptionLIKE${params.search_term}`;
        break;
      case 'all':
      default:
        query = `nameLIKE${params.search_term}^ORvalueLIKE${params.search_term}^ORdescriptionLIKE${params.search_term}`;
    }

    const response = await client.searchRecords(
      'sys_properties',
      query,
      params.limit
    );

    if (!response.success || !response.data?.result) {
      throw new Error('Search failed');
    }

    const results = response.data.result;

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No properties found matching: "${params.search_term}"`
        }]
      };
    }

    let output = `🔍 **Search Results** (Found: ${results.length})\n`;
    output += `Search term: "${params.search_term}" in ${params.search_in}\n\n`;

    for (const prop of results) {
      output += `**${prop.name}**\n`;
      output += `• Value: ${prop.value || '(empty)'}\n`;
      if (prop.description) {
        output += `• Description: ${prop.description}\n`;
      }
      output += '\n';
    }

    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error) {
    logger.error('Search failed:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_search',
  description: 'Search properties by name or value content',
  inputSchema: {
    type: 'object',
    properties: {
      search_term: {
        type: 'string',
        description: 'Search term to find in property names or values'
      },
      search_in: {
        type: 'string',
        enum: ['name', 'value', 'description', 'all'],
        description: 'Where to search',
        default: 'all'
      },
      limit: {
        type: 'number',
        description: 'Maximum results',
        default: 50
      }
    },
    required: ['search_term']
  }
};
