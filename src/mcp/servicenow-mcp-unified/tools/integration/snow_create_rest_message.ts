/**
 * snow_create_rest_message - REST API integration
 *
 * Create REST message configurations for external API integrations
 * with authentication, headers, and method templates.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_rest_message',
  description: 'Create REST message for external API integration',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'rest',
  use_cases: ['integration', 'rest', 'api'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'REST message name'
      },
      endpoint: {
        type: 'string',
        description: 'Base URL endpoint'
      },
      description: {
        type: 'string',
        description: 'REST message description'
      },
      authentication: {
        type: 'string',
        enum: ['none', 'basic', 'oauth2', 'api_key'],
        description: 'Authentication type',
        default: 'none'
      },
      use_mid_server: {
        type: 'boolean',
        description: 'Route through MID Server',
        default: false
      },
      mid_server: {
        type: 'string',
        description: 'MID Server name if use_mid_server is true'
      },
      methods: {
        type: 'array',
        description: 'HTTP methods to create',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            http_method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
            endpoint_path: { type: 'string' },
            headers: { type: 'object' }
          }
        }
      }
    },
    required: ['name', 'endpoint']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    endpoint,
    description = '',
    authentication = 'none',
    use_mid_server = false,
    mid_server,
    methods = []
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Create REST message
    const restMessageData: any = {
      name,
      endpoint,
      description,
      use_mid_server,
      authentication_type: authentication
    };

    if (use_mid_server && mid_server) {
      restMessageData.mid_server = mid_server;
    }

    const restMessageResponse = await client.post('/api/now/table/sys_rest_message', restMessageData);
    const restMessage = restMessageResponse.data.result;

    // Create HTTP methods
    const createdMethods = [];
    for (const method of methods) {
      const methodData = {
        rest_message: restMessage.sys_id,
        name: method.name,
        http_method: method.http_method,
        endpoint: endpoint + (method.endpoint_path || ''),
        rest_endpoint: endpoint + (method.endpoint_path || '')
      };

      const methodResponse = await client.post('/api/now/table/sys_rest_message_fn', methodData);
      createdMethods.push(methodResponse.data.result);

      // Create headers if specified
      if (method.headers) {
        for (const [headerName, headerValue] of Object.entries(method.headers)) {
          await client.post('/api/now/table/sys_rest_message_headers', {
            rest_message_function: methodResponse.data.result.sys_id,
            name: headerName,
            value: headerValue
          });
        }
      }
    }

    return createSuccessResult({
      created: true,
      rest_message: {
        sys_id: restMessage.sys_id,
        name: restMessage.name,
        endpoint: restMessage.endpoint,
        authentication: authentication
      },
      methods: createdMethods.map(m => ({
        sys_id: m.sys_id,
        name: m.name,
        http_method: m.http_method,
        endpoint: m.endpoint
      })),
      total_methods: createdMethods.length
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
