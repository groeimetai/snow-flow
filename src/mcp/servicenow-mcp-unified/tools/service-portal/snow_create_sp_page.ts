/**
 * snow_create_sp_page - Create Service Portal page
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_sp_page',
  description: 'Create Service Portal page',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ui-frameworks',
  subcategory: 'service-portal',
  use_cases: ['portal-pages', 'service-portal', 'page-creation'],
  complexity: 'beginner',
  frequency: 'medium',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      public: { type: 'boolean', default: false }
    },
    required: ['id', 'title']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { id, title, public: isPublic = false } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.post('/api/now/table/sp_page', { id, title, public: isPublic });
    return createSuccessResult({ created: true, page: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
