/**
 * snow_get_by_sysid - Get artifact by sys_id
 *
 * Retrieves artifacts by sys_id for precise, fast lookups.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_by_sysid',
  description: 'Retrieves artifacts by sys_id for precise, fast lookups. Auto-detects large responses and suggests efficient field-specific queries using snow_query_table when needed. More reliable than text-based searches when sys_id is known.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'query',
  use_cases: ['query', 'retrieval', 'sysid-lookup'],
  complexity: 'beginner',
  frequency: 'high',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: READ - Get operation - retrieves data
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: {
        type: 'string',
        description: 'System ID of the artifact'
      },
      table: {
        type: 'string',
        description: 'ServiceNow table name (e.g., sp_widget, wf_workflow, sys_script_include)'
      }
    },
    required: ['sys_id', 'table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { sys_id, table } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Retrieve artifact
    const response = await client.getRecord(table, sys_id);

    if (!response.data?.result) {
      throw new Error(`Artifact with sys_id ${sys_id} not found in table ${table}`);
    }

    const artifact = response.data.result;

    // Calculate response size
    const artifactJson = JSON.stringify(artifact);
    const sizeInBytes = new Blob([artifactJson]).size;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);

    // Check if response is large
    const isLarge = sizeInBytes > 50000; // >50KB

    const result: any = {
      artifact,
      metadata: {
        sys_id,
        table,
        name: artifact.name || artifact.title,
        size: `${sizeInKB} KB`,
        fields_count: Object.keys(artifact).length
      },
      url: `${context.instanceUrl}/nav_to.do?uri=${table}.do?sys_id=${sys_id}`
    };

    if (isLarge) {
      result.warning = 'Large artifact detected. Consider using field-specific queries for better performance.';
      result.suggestions = [
        'Use snow_query_table with specific field selection',
        'Use snow_pull_artifact for local editing with native tools'
      ];
    }

    return createSuccessResult(result, {
      sys_id,
      table,
      size_kb: parseFloat(sizeInKB)
    });

  } catch (error) {
    return createErrorResult(error, {
      sys_id,
      table
    });
  }
}
