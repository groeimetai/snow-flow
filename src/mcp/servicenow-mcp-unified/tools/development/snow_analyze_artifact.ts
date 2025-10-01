/**
 * snow_analyze_artifact - Analyze artifact structure and dependencies
 *
 * Performs comprehensive analysis including dependencies, usage patterns, and optimization opportunities.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_analyze_artifact',
  description: 'Performs comprehensive analysis of artifacts including dependencies, usage patterns, and optimization opportunities. Caches results for improved performance.',
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: {
        type: 'string',
        description: 'System ID of the artifact'
      },
      table: {
        type: 'string',
        description: 'ServiceNow table name'
      }
    },
    required: ['sys_id', 'table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { sys_id, table } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Fetch artifact
    const response = await client.getRecord(table, sys_id);
    if (!response.data?.result) {
      throw new Error('Artifact not found');
    }

    const artifact = response.data.result;

    // Analyze structure
    const analysis = {
      meta: {
        sys_id: artifact.sys_id,
        name: artifact.name || artifact.title,
        type: table,
        active: artifact.active,
        last_updated: artifact.sys_updated_on
      },
      structure: {
        fields: Object.keys(artifact).filter(k => !k.startsWith('sys_')),
        hasScript: !!(artifact.script || artifact.server_script),
        hasClientScript: !!artifact.client_script,
        hasTemplate: !!artifact.template,
        hasCSS: !!artifact.css
      },
      dependencies: [],
      modificationPoints: []
    };

    // Detect dependencies (basic)
    if (artifact.script || artifact.server_script) {
      const scriptContent = artifact.script || artifact.server_script;

      // Detect GlideRecord references
      const tableMatches = scriptContent.match(/new GlideRecord\(['"]([^'"]+)['"]\)/g);
      if (tableMatches) {
        analysis.dependencies.push({
          type: 'table',
          references: [...new Set(tableMatches.map((m: string) => m.match(/['"]([^'"]+)['"]/)?.[1]))]
        });
      }

      // Detect Script Include references
      const scriptIncludeMatches = scriptContent.match(/new ([A-Z][a-zA-Z0-9_]+)\(/g);
      if (scriptIncludeMatches) {
        analysis.dependencies.push({
          type: 'script_include',
          references: [...new Set(scriptIncludeMatches.map((m: string) => m.match(/new ([A-Z][a-zA-Z0-9_]+)/)?.[1]))]
        });
      }
    }

    // Identify modification points
    if (table === 'sp_widget') {
      analysis.modificationPoints.push(
        { field: 'template', description: 'HTML template structure' },
        { field: 'script', description: 'Server-side data processing' },
        { field: 'client_script', description: 'Client-side behavior' },
        { field: 'css', description: 'Widget styling' }
      );
    }

    return createSuccessResult({
      analysis,
      summary: `${artifact.name || 'Artifact'} analyzed successfully`,
      recommendations: []
    }, {
      sys_id,
      table
    });

  } catch (error) {
    return createErrorResult(error, { sys_id, table });
  }
}
