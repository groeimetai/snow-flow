/**
 * snow_create_ux_app_config - Create UX app configuration
 *
 * STEP 2: Create UX App Configuration Record (sys_ux_app_config) -
 * Contains workspace settings and links to the experience from Step 1.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_ux_app_config',
  description: 'STEP 2: Create UX App Configuration Record (sys_ux_app_config) - Contains workspace settings and links to the experience from Step 1.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'App config name (e.g., "My Workspace Config")'
      },
      experience_sys_id: {
        type: 'string',
        description: 'Experience sys_id from Step 1'
      },
      description: {
        type: 'string',
        description: 'App configuration description'
      },
      list_config_id: {
        type: 'string',
        description: 'List menu configuration sys_id (optional)'
      }
    },
    required: ['name', 'experience_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, experience_sys_id, description, list_config_id } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Validate experience exists
    const experienceCheck = await client.get(`/api/now/table/sys_ux_experience/${experience_sys_id}`);
    if (!experienceCheck.data.result) {
      throw new SnowFlowError(
        ErrorType.VALIDATION_ERROR,
        `Experience '${experience_sys_id}' not found`,
        { details: { experience_sys_id } }
      );
    }

    // Create app config
    const appConfigData: any = {
      name,
      experience_assoc: experience_sys_id,
      description: description || `App configuration for ${name}`,
      active: true
    };

    if (list_config_id) {
      appConfigData.list_config_id = list_config_id;
    }

    const response = await client.post('/api/now/table/sys_ux_app_config', appConfigData);
    const appConfig = response.data.result;

    return createSuccessResult({
      created: true,
      app_config_sys_id: appConfig.sys_id,
      name: appConfig.name,
      experience_sys_id,
      list_config_id: appConfig.list_config_id || null,
      message: `UX App Configuration '${name}' created successfully`,
      next_step: 'Create Page Macroponent (Step 3) using snow_create_ux_page_macroponent'
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
