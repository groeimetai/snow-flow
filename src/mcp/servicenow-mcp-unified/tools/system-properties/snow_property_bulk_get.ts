/**
 * Get multiple properties at once
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const schema = z.object({
  names: z.array(z.string()).describe('Array of property names to retrieve'),
  include_metadata: z.boolean().optional().default(false).describe('Include full metadata for each property'),
});

export async function snow_property_bulk_get(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_bulk_get');

  try {
    logger.info(`Bulk getting ${params.names.length} properties`);

    const results: Record<string, any> = {};
    const errors: string[] = [];

    for (const name of params.names) {
      try {
        const response = await client.searchRecords(
          'sys_properties',
          `name=${name}`,
          1
        );

        if (response.success && response.data?.result?.length > 0) {
          const prop = response.data.result[0];
          results[name] = params.include_metadata ? prop : prop.value;
        } else {
          results[name] = null;
          errors.push(name);
        }
      } catch (error) {
        logger.error(`Failed to get property ${name}:`, error);
        results[name] = null;
        errors.push(name);
      }
    }

    let output = `📋 **Bulk Property Retrieval**\n\n`;

    if (params.include_metadata) {
      output += JSON.stringify(results, null, 2);
    } else {
      for (const [name, value] of Object.entries(results)) {
        output += `• ${name} = ${value !== null ? `"${value}"` : 'NOT FOUND'}\n`;
      }
    }

    if (errors.length > 0) {
      output += `\n⚠️ Properties not found: ${errors.join(', ')}`;
    }

    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error) {
    logger.error('Bulk get failed:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Bulk get failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_bulk_get',
  description: 'Get multiple properties at once',
  inputSchema: {
    type: 'object',
    properties: {
      names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of property names to retrieve'
      },
      include_metadata: {
        type: 'boolean',
        description: 'Include full metadata for each property',
        default: false
      }
    },
    required: ['names']
  }
};
