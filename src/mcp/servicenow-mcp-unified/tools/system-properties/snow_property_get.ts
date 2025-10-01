/**
 * Get a system property value by name
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const schema = z.object({
  name: z.string().describe('Property name (e.g., glide.servlet.uri)'),
  include_metadata: z.boolean().optional().default(false).describe('Include full property metadata'),
});

export async function snow_property_get(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_get');

  try {
    logger.info(`Getting property: ${params.name}`);
    logger.trackAPICall('SEARCH', 'sys_properties', 1);

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

    const property = response.data.result[0];

    if (params.include_metadata) {
      return {
        content: [{
          type: 'text',
          text: `📋 **Property: ${params.name}**

**Value:** ${property.value || '(empty)'}
**Type:** ${property.type || 'string'}
**Description:** ${property.description || 'No description'}
**Suffix:** ${property.suffix || 'global'}
**Private:** ${property.is_private === 'true' ? 'Yes' : 'No'}
**Choices:** ${property.choices || 'None'}
**sys_id:** ${property.sys_id}

✅ Property retrieved successfully`
        }]
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: property.value || ''
        }]
      };
    }
  } catch (error) {
    logger.error('Failed to get property:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get property: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_get',
  description: 'Get a system property value by name',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Property name (e.g., glide.servlet.uri)'
      },
      include_metadata: {
        type: 'boolean',
        description: 'Include full property metadata',
        default: false
      }
    },
    required: ['name']
  }
};
