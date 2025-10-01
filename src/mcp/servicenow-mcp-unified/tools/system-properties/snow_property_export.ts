/**
 * Export system properties to JSON format
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const schema = z.object({
  pattern: z.string().optional().describe('Pattern to filter properties (e.g., glide.*)'),
  include_system: z.boolean().optional().default(false).describe('Include system properties'),
  include_private: z.boolean().optional().default(false).describe('Include private properties'),
});

export async function snow_property_export(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_export');

  try {
    logger.info('Exporting properties', { pattern: params.pattern, include_system: params.include_system, include_private: params.include_private });

    const conditions = [];

    if (params.pattern) {
      if (params.pattern.includes('*')) {
        const likePattern = params.pattern.replace(/\*/g, '');
        conditions.push(`nameLIKE${likePattern}`);
      } else {
        conditions.push(`name=${params.pattern}`);
      }
    }

    if (!params.include_system) {
      conditions.push(`name!=glide.*^name!=sys.*`);
    }

    if (!params.include_private) {
      conditions.push(`is_private=false`);
    }

    const query = conditions.join('^');

    const response = await client.searchRecords(
      'sys_properties',
      query,
      1000
    );

    if (!response.success || !response.data?.result) {
      throw new Error('Export failed');
    }

    const properties = response.data.result;
    const exportData: Record<string, any> = {};

    for (const prop of properties) {
      exportData[prop.name] = {
        value: prop.value,
        type: prop.type || 'string',
        description: prop.description || '',
        suffix: prop.suffix || 'global',
        is_private: prop.is_private === 'true',
        choices: prop.choices || ''
      };
    }

    return {
      content: [{
        type: 'text',
        text: `📤 **Properties Export** (${properties.length} properties)

\`\`\`json
${JSON.stringify(exportData, null, 2)}
\`\`\`

✅ Export complete. You can save this JSON for backup or migration.`
      }]
    };
  } catch (error) {
    logger.error('Export failed:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Export failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_export',
  description: 'Export system properties to JSON format',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern to filter properties (e.g., glide.*)'
      },
      include_system: {
        type: 'boolean',
        description: 'Include system properties',
        default: false
      },
      include_private: {
        type: 'boolean',
        description: 'Include private properties',
        default: false
      }
    }
  }
};
