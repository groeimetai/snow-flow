/**
 * snow_create_ux_experience - Create UX experience
 *
 * STEP 1: Create UX Experience Record (sys_ux_experience) -
 * The top-level container for the workspace.
 * ⚠️ REQUIRES: Now Experience Framework (UXF) enabled.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_ux_experience',
  description: 'STEP 1: Create UX Experience Record (sys_ux_experience) - The top-level container for the workspace. ⚠️ REQUIRES: Now Experience Framework (UXF) enabled. ALTERNATIVE: Use traditional form/list configurations if UXF unavailable.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ui-frameworks',
  subcategory: 'workspace',
  use_cases: ['workspace', 'ux-experience', 'foundation'],
  complexity: 'beginner',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Experience name (e.g., "My Workspace")'
      },
      root_macroponent: {
        type: 'string',
        description: 'Root macroponent sys_id (usually x_snc_app_shell_uib_app_shell, auto-detected if not provided)'
      },
      description: {
        type: 'string',
        description: 'Experience description'
      }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, root_macroponent, description } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Create experience
    const experienceData: any = {
      name,
      description: description || `UX Experience: ${name}`,
      active: true
    };

    if (root_macroponent) {
      experienceData.root_macroponent = root_macroponent;
    }

    const response = await client.post('/api/now/table/sys_ux_experience', experienceData);
    const experience = response.data.result;

    return createSuccessResult({
      created: true,
      experience_sys_id: experience.sys_id,
      name: experience.name,
      root_macroponent: experience.root_macroponent || null,
      message: `UX Experience '${name}' created successfully`,
      next_step: 'Create App Configuration (Step 2) using snow_create_ux_app_config',
      note: 'This experience requires Now Experience Framework (UXF) to be enabled'
    });

  } catch (error: any) {
    // Check if error is due to missing UXF plugin
    if (error.message && error.message.includes('sys_ux_experience')) {
      return createErrorResult(
        new SnowFlowError(
          ErrorType.PLUGIN_MISSING,
          'Now Experience Framework (UXF) plugin not installed or enabled',
          {
            details: {
              plugin: 'com.snc.now_experience',
              suggestion: 'Install Now Experience Framework from ServiceNow Store or use traditional form/list configurations',
              alternative: 'Use Service Portal pages or traditional UI pages instead'
            }
          }
        )
      );
    }

    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
