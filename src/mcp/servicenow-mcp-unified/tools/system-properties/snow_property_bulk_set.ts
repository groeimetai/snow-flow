/**
 * Set multiple properties at once
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const PropertySchema = z.object({
  name: z.string(),
  value: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
});

const schema = z.object({
  properties: z.array(PropertySchema).describe('Array of properties to set'),
});

export async function snow_property_bulk_set(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_bulk_set');

  try {
    logger.info(`Bulk setting ${params.properties.length} properties`);

    const results = {
      created: [] as string[],
      updated: [] as string[],
      failed: [] as string[]
    };

    for (const prop of params.properties) {
      try {
        // Check if exists
        const existing = await client.searchRecords(
          'sys_properties',
          `name=${prop.name}`,
          1
        );

        let result;
        if (existing.success && existing.data?.result?.length > 0) {
          // Update
          const sys_id = existing.data.result[0].sys_id;
          result = await client.updateRecord('sys_properties', sys_id, {
            value: prop.value,
            ...(prop.description && { description: prop.description }),
            ...(prop.type && { type: prop.type })
          });

          if (result.success) {
            results.updated.push(prop.name);
          } else {
            results.failed.push(`${prop.name}: ${result.error}`);
          }
        } else {
          // Create
          logger.trackAPICall('CREATE', 'sys_properties', 1);
          result = await client.createRecord('sys_properties', {
            name: prop.name,
            value: prop.value,
            description: prop.description || `Created by Snow-Flow bulk operation`,
            type: prop.type || 'string'
          });

          if (result.success) {
            results.created.push(prop.name);
          } else {
            results.failed.push(`${prop.name}: ${result.error}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to set property ${prop.name}:`, error);
        results.failed.push(`${prop.name}: ${error}`);
      }
    }

    return {
      content: [{
        type: 'text',
        text: `📦 **Bulk Property Update Results**

✅ **Created:** ${results.created.length}
${results.created.map(n => `• ${n}`).join('\n')}

🔄 **Updated:** ${results.updated.length}
${results.updated.map(n => `• ${n}`).join('\n')}

${results.failed.length > 0 ? `❌ **Failed:** ${results.failed.length}\n${results.failed.map(f => `• ${f}`).join('\n')}` : ''}

Total processed: ${params.properties.length}`
      }]
    };
  } catch (error) {
    logger.error('Bulk set failed:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Bulk set failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_bulk_set',
  description: 'Set multiple properties at once',
  inputSchema: {
    type: 'object',
    properties: {
      properties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string' }
          },
          required: ['name', 'value']
        },
        description: 'Array of properties to set'
      }
    },
    required: ['properties']
  }
};
