/**
 * snow_create_uib_component - Create custom components
 *
 * Creates custom UI Builder components with source code for reuse
 * across pages.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_uib_component',
  description: 'Create custom UI Builder component with source code',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Component name (internal identifier)'
      },
      label: {
        type: 'string',
        description: 'Component label (display name)'
      },
      description: {
        type: 'string',
        description: 'Component description'
      },
      category: {
        type: 'string',
        description: 'Component category',
        default: 'custom'
      },
      source_code: {
        type: 'string',
        description: 'Component JavaScript source code'
      },
      template: {
        type: 'string',
        description: 'Component HTML template'
      },
      styles: {
        type: 'string',
        description: 'Component CSS styles'
      },
      properties: {
        type: 'object',
        description: 'Component properties schema'
      },
      version: {
        type: 'string',
        description: 'Component version',
        default: '1.0.0'
      }
    },
    required: ['name', 'label']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    label,
    description = '',
    category = 'custom',
    source_code = '',
    template = '',
    styles = '',
    properties = {},
    version = '1.0.0'
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    const payload: any = {
      name,
      label,
      description,
      category,
      version
    };

    if (source_code) payload.source_code = source_code;
    if (template) payload.template = template;
    if (styles) payload.styles = styles;
    if (Object.keys(properties).length > 0) payload.properties = JSON.stringify(properties);

    const response = await client.post('/api/now/table/sys_ux_lib_component', payload);

    return createSuccessResult({
      component: {
        sys_id: response.data.result.sys_id,
        name,
        label,
        category
      }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
