/**
 * Validate property value against its type and constraints
 * Uses official ServiceNow Table API on sys_properties
 */

import { z } from 'zod';
import { ServiceNowClient } from '../../../../utils/servicenow-client.js';
import { MCPLogger } from '../../../shared/mcp-logger.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const schema = z.object({
  name: z.string().describe('Property name'),
  value: z.string().describe('Value to validate'),
});

export async function snow_property_validate(args: unknown) {
  const params = schema.parse(args);
  const client = new ServiceNowClient();
  const logger = new MCPLogger('snow_property_validate');

  try {
    logger.info(`Validating property: ${params.name} = ${params.value}`);

    // Get property metadata
    const response = await client.searchRecords(
      'sys_properties',
      `name=${params.name}`,
      1
    );

    if (!response.success || !response.data?.result?.length) {
      return {
        content: [{
          type: 'text',
          text: `❌ Property not found: ${params.name}. Cannot validate.`
        }]
      };
    }

    const property = response.data.result[0];
    const validationResults = [];
    let isValid = true;

    // Type validation
    if (property.type) {
      switch (property.type) {
        case 'boolean':
          if (!['true', 'false', '1', '0'].includes(params.value.toLowerCase())) {
            validationResults.push('❌ Value must be true/false');
            isValid = false;
          } else {
            validationResults.push('✅ Valid boolean value');
          }
          break;
        case 'integer':
          if (!/^-?\d+$/.test(params.value)) {
            validationResults.push('❌ Value must be an integer');
            isValid = false;
          } else {
            validationResults.push('✅ Valid integer value');
          }
          break;
        case 'float':
        case 'decimal':
          if (!/^-?\d*\.?\d+$/.test(params.value)) {
            validationResults.push('❌ Value must be a number');
            isValid = false;
          } else {
            validationResults.push('✅ Valid numeric value');
          }
          break;
        case 'string':
        default:
          validationResults.push('✅ Valid string value');
      }
    }

    // Choices validation
    if (property.choices) {
      const validChoices = property.choices.split(',').map((c: string) => c.trim());
      if (!validChoices.includes(params.value)) {
        validationResults.push(`❌ Value must be one of: ${validChoices.join(', ')}`);
        isValid = false;
      } else {
        validationResults.push('✅ Valid choice');
      }
    }

    return {
      content: [{
        type: 'text',
        text: `🔍 **Property Validation: ${params.name}**

**Current Value:** ${property.value}
**New Value:** ${params.value}
**Type:** ${property.type || 'string'}
${property.choices ? `**Valid Choices:** ${property.choices}` : ''}

**Validation Results:**
${validationResults.join('\n')}

**Overall:** ${isValid ? '✅ VALID' : '❌ INVALID'}`
      }]
    };
  } catch (error) {
    logger.error('Validation failed:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const tool = {
  name: 'snow_property_validate',
  description: 'Validate property value against its type and constraints',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Property name'
      },
      value: {
        type: 'string',
        description: 'Value to validate'
      }
    },
    required: ['name', 'value']
  }
};
