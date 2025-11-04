/**
 * snow_update_ux_app_config_landing_page - Update landing page
 *
 * STEP 6: Update App Configuration with Landing Page Route -
 * Sets the default landing page for the workspace.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_ux_app_config_landing_page',
  description: 'STEP 6: Update App Configuration with Landing Page Route - Sets the default landing page for the workspace.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ui-frameworks',
  subcategory: 'workspace',
  use_cases: ['workspace', 'configuration', 'landing-page'],
  complexity: 'beginner',
  frequency: 'low',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Update operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      app_config_sys_id: {
        type: 'string',
        description: 'App config sys_id from Step 2'
      },
      route_name: {
        type: 'string',
        description: 'Route name from Step 5'
      }
    },
    required: ['app_config_sys_id', 'route_name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { app_config_sys_id, route_name } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Validate app config exists
    const appConfigCheck = await client.get(`/api/now/table/sys_ux_app_config/${app_config_sys_id}`);
    if (!appConfigCheck.data.result) {
      throw new SnowFlowError(
        ErrorType.VALIDATION_ERROR,
        `App Config '${app_config_sys_id}' not found`,
        { details: { app_config_sys_id } }
      );
    }

    // Update app config with landing page route
    const updateData = {
      landing_page: route_name
    };

    const response = await client.patch(`/api/now/table/sys_ux_app_config/${app_config_sys_id}`, updateData);
    const appConfig = response.data.result;

    return createSuccessResult({
      updated: true,
      app_config_sys_id: appConfig.sys_id,
      landing_page: appConfig.landing_page,
      message: `App Configuration landing page set to '${route_name}'`,
      workspace_complete: true,
      summary: 'All 6 steps completed! Your UX workspace is now fully configured and ready to use.'
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
