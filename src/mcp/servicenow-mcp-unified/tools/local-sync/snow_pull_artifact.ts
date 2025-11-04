/**
 * snow_pull_artifact - Pull artifact to local files
 *
 * Pull ServiceNow artifacts to local files for editing with Claude Code
 * native tools. Enables powerful multi-file editing and search.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_pull_artifact',
  description: 'Pull ServiceNow artifact to local files for editing with native tools',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'local-sync',
  use_cases: ['local-development', 'artifact-sync', 'editing'],
  complexity: 'beginner',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Write operation based on name pattern
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: {
        type: 'string',
        description: 'sys_id of artifact to pull'
      },
      table: {
        type: 'string',
        description: 'Table name (optional, will auto-detect if not provided)',
        enum: ['sp_widget', 'sys_ux_page', 'sys_hub_flow', 'sys_script_include']
      },
      output_dir: {
        type: 'string',
        description: 'Local directory to save files (default: /tmp/snow-flow-artifacts)'
      }
    },
    required: ['sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { sys_id, table, output_dir = path.join(os.tmpdir(), 'snow-flow-artifacts') } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Auto-detect table if not provided
    let artifactTable = table;
    if (!artifactTable) {
      artifactTable = await detectArtifactTable(client, sys_id);
    }

    // Get artifact data
    const response = await client.get(`/api/now/table/${artifactTable}/${sys_id}`);
    if (!response.data || !response.data.result) {
      return createErrorResult(`Artifact not found: ${sys_id}`);
    }

    const artifact = response.data.result;

    // Create output directory
    const artifactName = artifact.name || artifact.id || sys_id;
    const artifactDir = path.join(output_dir, artifactTable, artifactName);
    await fs.mkdir(artifactDir, { recursive: true });

    const files: string[] = [];

    // Extract files based on artifact type
    if (artifactTable === 'sp_widget') {
      // Widget files
      if (artifact.template) {
        const templateFile = path.join(artifactDir, `${artifactName}.html`);
        await fs.writeFile(templateFile, artifact.template, 'utf-8');
        files.push(templateFile);
      }

      if (artifact.script) {
        const scriptFile = path.join(artifactDir, `${artifactName}.server.js`);
        await fs.writeFile(scriptFile, artifact.script, 'utf-8');
        files.push(scriptFile);
      }

      if (artifact.client_script) {
        const clientFile = path.join(artifactDir, `${artifactName}.client.js`);
        await fs.writeFile(clientFile, artifact.client_script, 'utf-8');
        files.push(clientFile);
      }

      if (artifact.css) {
        const cssFile = path.join(artifactDir, `${artifactName}.css`);
        await fs.writeFile(cssFile, artifact.css, 'utf-8');
        files.push(cssFile);
      }

      if (artifact.option_schema) {
        const optionsFile = path.join(artifactDir, `${artifactName}.options.json`);
        await fs.writeFile(optionsFile, artifact.option_schema, 'utf-8');
        files.push(optionsFile);
      }

    } else if (artifactTable === 'sys_script_include') {
      // Script Include
      const scriptFile = path.join(artifactDir, `${artifactName}.js`);
      await fs.writeFile(scriptFile, artifact.script || '', 'utf-8');
      files.push(scriptFile);
    }

    // Create README with context
    const readmeFile = path.join(artifactDir, 'README.md');
    const readme = `# ${artifactName}

**Type:** ${artifactTable}
**sys_id:** ${sys_id}
**Description:** ${artifact.description || 'No description'}

## Files

${files.map(f => `- ${path.basename(f)}`).join('\n')}

## Instructions

1. Edit files using Claude Code native tools
2. Use multi-file search and refactoring
3. Validate changes with snow_validate_artifact_coherence
4. Push changes back with snow_push_artifact

## Original Data

\`\`\`json
${JSON.stringify(artifact, null, 2)}
\`\`\`
`;
    await fs.writeFile(readmeFile, readme, 'utf-8');
    files.push(readmeFile);

    return createSuccessResult({
      directory: artifactDir,
      files,
      artifact: {
        sys_id,
        table: artifactTable,
        name: artifactName
      }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

async function detectArtifactTable(client: any, sys_id: string): Promise<string> {
  const tables = ['sp_widget', 'sys_ux_page', 'sys_hub_flow', 'sys_script_include'];

  for (const table of tables) {
    try {
      const response = await client.get(`/api/now/table/${table}/${sys_id}`, {
        params: { sysparm_fields: 'sys_id' }
      });
      if (response.data && response.data.result) {
        return table;
      }
    } catch (e) {
      continue;
    }
  }

  throw new Error(`Could not detect table for sys_id: ${sys_id}`);
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
