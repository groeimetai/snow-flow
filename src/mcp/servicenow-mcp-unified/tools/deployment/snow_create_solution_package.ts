/**
 * snow_create_solution_package - Create solution packages
 *
 * Creates comprehensive solution packages containing multiple related artifacts
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_solution_package',
  description: 'Creates comprehensive solution packages containing multiple related artifacts (widgets, scripts, rules). Manages dependencies and generates deployment documentation.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'deployment',
  use_cases: ['deployment', 'packaging', 'solution'],
  complexity: 'advanced',
  frequency: 'low',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Solution package name' },
      description: { type: 'string', description: 'Package description' },
      artifacts: {
        type: 'array',
        description: 'Artifacts to include in the package',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['widget', 'script_include', 'business_rule', 'table'] },
            create: { type: 'object', description: 'Artifact creation configuration' },
          },
        },
      },
      new_update_set: { type: 'boolean', description: 'Force new update set', default: true },
    },
    required: ['name', 'artifacts'],
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, description, artifacts, new_update_set = true } = args;

  try {
    const client = await getAuthenticatedClient(context);
    const results: any = {
      package_name: name,
      created_artifacts: [],
      update_set_id: null,
      errors: []
    };

    // Step 1: Create Update Set for the package
    if (new_update_set) {
      const updateSetResponse = await client.post('/api/now/table/sys_update_set', {
        name: `${name} - Solution Package`,
        description: description || `Solution package: ${name}`,
        state: 'in progress'
      });
      results.update_set_id = updateSetResponse.data.result.sys_id;

      // Set as current Update Set
      await client.put(`/api/now/table/sys_update_set/${results.update_set_id}`, {
        is_current: true
      });
    }

    // Step 2: Create each artifact
    for (const artifact of artifacts) {
      try {
        const tableMap: Record<string, string> = {
          widget: 'sp_widget',
          script_include: 'sys_script_include',
          business_rule: 'sys_script',
          table: 'sys_db_object'
        };

        const tableName = tableMap[artifact.type];
        if (!tableName) {
          results.errors.push(`Unsupported artifact type: ${artifact.type}`);
          continue;
        }

        const createResponse = await client.post(`/api/now/table/${tableName}`, artifact.create);

        results.created_artifacts.push({
          type: artifact.type,
          sys_id: createResponse.data.result.sys_id,
          name: createResponse.data.result.name || createResponse.data.result.id,
          table: tableName
        });

      } catch (artifactError: any) {
        results.errors.push({
          type: artifact.type,
          error: artifactError.message
        });
      }
    }

    // Step 3: Generate deployment documentation
    const documentation = {
      package: name,
      description,
      created_at: new Date().toISOString(),
      update_set: results.update_set_id,
      artifacts: results.created_artifacts,
      total_artifacts: results.created_artifacts.length,
      total_errors: results.errors.length
    };

    const message = `✅ Solution Package Created\n\n` +
      `Package: ${name}\n` +
      `Update Set: ${results.update_set_id}\n` +
      `Artifacts Created: ${results.created_artifacts.length}\n` +
      `Errors: ${results.errors.length}\n\n` +
      `Artifacts:\n${results.created_artifacts.map((a: any) => `- ${a.type}: ${a.name} (${a.sys_id})`).join('\n')}` +
      (results.errors.length > 0 ? `\n\nErrors:\n${results.errors.map((e: any) => `- ${typeof e === 'string' ? e : e.error}`).join('\n')}` : '');

    return createSuccessResult(
      {
        ...results,
        documentation
      },
      { message }
    );

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.NETWORK_ERROR, `Solution package creation failed: ${error.message}`, { originalError: error })
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
