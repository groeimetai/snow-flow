/**
 * snow_create_solution_package - Create solution packages with MULTIPLE artifacts
 *
 * ⚠️ USE THIS ONLY FOR MULTI-ARTIFACT SOLUTIONS!
 * For creating a SINGLE widget, script, or artifact → use snow_artifact_manage instead!
 *
 * This tool is for bundling MULTIPLE related artifacts into one deployment package.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';
import { execute as executeArtifactManage } from './snow_artifact_manage.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_solution_package',
  description: `Creates a MULTI-ARTIFACT solution package with Update Set tracking.

⚠️ WHEN TO USE THIS TOOL:
- Creating 3+ related artifacts that form a complete solution
- Need automatic Update Set creation for the entire package
- Deploying a "feature bundle" (e.g., widget + script includes + business rules)

❌ DO NOT USE FOR:
- Creating a SINGLE widget → use snow_artifact_manage instead
- Creating a SINGLE script include → use snow_artifact_manage instead
- Creating individual artifacts → use snow_artifact_manage instead

✅ GOOD USE CASE:
"Create HR Portal solution with: widget, 2 script includes, 1 business rule"

❌ BAD USE CASE:
"Create a widget for displaying incidents" → Use snow_artifact_manage!`,
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'deployment',
  use_cases: ['multi-artifact', 'solution-bundle', 'feature-package'],
  complexity: 'advanced',
  frequency: 'low',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
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

    // Step 2: Create each artifact using snow_artifact_manage (DRY principle)
    for (const artifact of artifacts) {
      try {
        // Delegate to snow_artifact_manage for artifact creation
        const artifactResult = await executeArtifactManage({
          action: 'create',
          type: artifact.type,
          ...artifact.create  // Spread the create config (name, script, template, etc.)
        }, context);

        if (!artifactResult.success) {
          results.errors.push({
            type: artifact.type,
            error: artifactResult.error || 'Unknown error'
          });
          continue;
        }

        // Extract result data from the successful response
        const resultData = artifactResult.data || {};

        results.created_artifacts.push({
          type: artifact.type,
          sys_id: resultData.sys_id,
          name: resultData.name,
          table: resultData.table,
          url: resultData.url
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
