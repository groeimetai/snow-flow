/**
 * List all property categories
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const schema = z.object({
  include_counts: z.boolean().optional().default(true).describe('Include count of properties per category'),
});

export async function snow_property_categories(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_categories');

  try {
    logger.info('Getting property categories');

    // Get distinct suffixes (categories)
    const response = await client.searchRecords(
      'sys_properties',
      '',
      1000
    );

    if (!response.success || !response.data?.result) {
      throw new Error('Failed to get categories');
    }

    const categories: Record<string, number> = {};

    for (const prop of response.data.result) {
      const category = prop.suffix || 'global';
      categories[category] = (categories[category] || 0) + 1;
    }

    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);

    let output = `📂 **Property Categories**\n\n`;

    for (const [category, count] of sorted) {
      if (params.include_counts) {
        output += `• **${category}** (${count} properties)\n`;
      } else {
        output += `• ${category}\n`;
      }
    }

    output += `\n📊 Total categories: ${sorted.length}`;
    output += `\n📋 Total properties: ${response.data.result.length}`;

    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error) {
    logger.error('Failed to get categories:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get categories: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_categories',
  description: 'List all property categories',
  inputSchema: {
    type: 'object',
    properties: {
      include_counts: {
        type: 'boolean',
        description: 'Include count of properties per category',
        default: true
      }
    }
  }
};
