/**
 * snow_update - Update ServiceNow artifacts
 *
 * Universal artifact update tool supporting widgets, pages, scripts, flows, and more.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update',
  description: 'Update existing ServiceNow artifacts (widgets, pages, scripts, flows, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Artifact type to update',
        enum: [
          'widget', 'page', 'script_include', 'business_rule', 'client_script',
          'ui_policy', 'ui_action', 'rest_message', 'flow', 'table', 'field'
        ]
      },
      identifier: {
        type: 'string',
        description: 'Artifact identifier (sys_id or name)'
      },
      config: {
        type: 'object',
        description: 'Fields to update (only specified fields will be changed)'
      },
      validate: {
        type: 'boolean',
        description: 'Validate before update',
        default: true
      },
      create_backup: {
        type: 'boolean',
        description: 'Create backup before update',
        default: false
      }
    },
    required: ['type', 'identifier', 'config']
  }
};

const ARTIFACT_TABLE_MAP: Record<string, string> = {
  widget: 'sp_widget',
  page: 'sp_page',
  script_include: 'sys_script_include',
  business_rule: 'sys_script',
  client_script: 'sys_script_client',
  ui_policy: 'sys_ui_policy',
  ui_action: 'sys_ui_action',
  rest_message: 'sys_rest_message',
  flow: 'sys_hub_flow',
  table: 'sys_db_object',
  field: 'sys_dictionary'
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { type, identifier, config, validate = true, create_backup = false } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Get table name for artifact type
    const tableName = ARTIFACT_TABLE_MAP[type];
    if (!tableName) {
      return createErrorResult(`Unsupported artifact type: ${type}`);
    }

    // Find the artifact
    const artifact = await findArtifact(client, tableName, identifier);
    if (!artifact) {
      return createErrorResult(`${type} '${identifier}' not found`);
    }

    const sysId = artifact.sys_id;

    // Validate if requested
    if (validate) {
      const validation = await validateUpdate(type, artifact, config);
      if (!validation.valid) {
        return createErrorResult(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Create backup if requested
    let backupId = null;
    if (create_backup) {
      backupId = await createArtifactBackup(client, tableName, sysId, artifact);
    }

    // Perform the update
    const updateResponse = await client.patch(`/api/now/table/${tableName}/${sysId}`, config);

    const result = {
      updated: true,
      type,
      sys_id: sysId,
      identifier,
      updated_fields: Object.keys(config),
      backup_id: backupId,
      artifact: updateResponse.data.result
    };

    return createSuccessResult(result, { type, identifier });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

async function findArtifact(client: any, tableName: string, identifier: string): Promise<any> {
  // Try by sys_id first
  try {
    const response = await client.get(`/api/now/table/${tableName}/${identifier}`);
    if (response.data.result) {
      return response.data.result;
    }
  } catch {
    // Not a valid sys_id, try by name
  }

  // Try by name
  const response = await client.get(`/api/now/table/${tableName}`, {
    params: {
      sysparm_query: `name=${identifier}`,
      sysparm_limit: 1
    }
  });

  if (response.data.result && response.data.result.length > 0) {
    return response.data.result[0];
  }

  return null;
}

async function validateUpdate(type: string, currentArtifact: any, updates: any): Promise<any> {
  const validation: any = {
    valid: true,
    errors: [],
    warnings: []
  };

  // Type-specific validation
  switch (type) {
    case 'widget':
      if (updates.script && updates.script.includes('const ') || updates.script?.includes('let ')) {
        validation.errors.push('Widget server script must use ES5 syntax (no const/let)');
        validation.valid = false;
      }

      if (updates.template && !updates.template.trim()) {
        validation.errors.push('Widget template cannot be empty');
        validation.valid = false;
      }
      break;

    case 'script_include':
      if (updates.script && (updates.script.includes('const ') || updates.script.includes('let '))) {
        validation.errors.push('Script Include must use ES5 syntax (no const/let)');
        validation.valid = false;
      }

      if (updates.client_callable === true && !updates.access) {
        validation.warnings.push('Client callable script include should have access control specified');
      }
      break;

    case 'business_rule':
      if (updates.script && (updates.script.includes('const ') || updates.script.includes('let '))) {
        validation.errors.push('Business rule must use ES5 syntax (no const/let)');
        validation.valid = false;
      }

      if (updates.when && !['before', 'after', 'async', 'display'].includes(updates.when)) {
        validation.errors.push('Invalid business rule timing');
        validation.valid = false;
      }
      break;
  }

  return validation;
}

async function createArtifactBackup(
  client: any,
  tableName: string,
  sysId: string,
  artifact: any
): Promise<string> {
  const backupData = {
    table: tableName,
    record_sys_id: sysId,
    backup_data: JSON.stringify(artifact),
    created: new Date().toISOString()
  };

  const response = await client.post('/api/now/table/sys_update_xml_backup', backupData);
  return response.data.result.sys_id;
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
