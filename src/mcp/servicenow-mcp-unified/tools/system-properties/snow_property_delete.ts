/**
 * Delete a system property
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const schema = z.object({
  name: z.string().describe('Property name to delete'),
  confirm: z.boolean().default(false).describe('Confirmation flag (must be true)'),
});

export async function snow_property_delete(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_delete');

  if (!params.confirm) {
    return {
      content: [{
        type: 'text',
        text: `⚠️ Deletion requires confirmation. Set confirm: true to proceed.

**Property to delete:** ${params.name}

⚠️ WARNING: Deleting system properties can affect ServiceNow functionality!`
      }]
    };
  }

  try {
    logger.info(`Deleting property: ${params.name}`);

    // Find the property
    const response = await client.searchRecords(
      'sys_properties',
      `name=${params.name}`,
      1
    );

    if (!response.success || !response.data?.result?.length) {
      return {
        content: [{
          type: 'text',
          text: `❌ Property not found: ${params.name}`
        }]
      };
    }

    const sys_id = response.data.result[0].sys_id;
    const result = await client.deleteRecord('sys_properties', sys_id);

    if (!result.success) {
      throw new Error(`Failed to delete property: ${result.error}`);
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Property deleted successfully: ${params.name}

⚠️ Note: Some properties may be recreated by ServiceNow on next access with default values.`
      }]
    };
  } catch (error) {
    logger.error('Failed to delete property:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to delete property: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_delete',
  description: 'Delete a system property',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Property name to delete'
      },
      confirm: {
        type: 'boolean',
        description: 'Confirmation flag (must be true)',
        default: false
      }
    },
    required: ['name', 'confirm']
  }
};
