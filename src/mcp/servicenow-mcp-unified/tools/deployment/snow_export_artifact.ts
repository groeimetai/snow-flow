/**
 * snow_export_artifact - Export ServiceNow artifacts
 *
 * Exports widgets, applications to JSON/XML format for backup or migration
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_export_artifact',
  description: 'Exports ServiceNow artifacts (widgets, applications) to JSON/XML format for backup, version control, or migration purposes.',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['widget', 'application'], description: 'Artifact type' },
      sys_id: { type: 'string', description: 'Sys ID of the artifact' },
      format: { type: 'string', enum: ['json', 'xml', 'update_set'], default: 'json', description: 'Export format' },
    },
    required: ['type', 'sys_id'],
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { type, sys_id, format = 'json' } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Determine table name based on artifact type
    const tableMap: Record<string, string> = {
      widget: 'sp_widget',
      application: 'sys_app',
      script: 'sys_script_include',
      business_rule: 'sys_script',
      table: 'sys_db_object'
    };

    const tableName = tableMap[type];
    if (!tableName) {
      throw new SnowFlowError(
        ErrorType.INVALID_REQUEST,
        `Unsupported artifact type: ${type}`,
        { retryable: false }
      );
    }

    // Fetch the artifact
    const response = await client.get(`/api/now/table/${tableName}/${sys_id}`);
    const artifact = response.data.result;

    if (!artifact) {
      throw new SnowFlowError(
        ErrorType.RESOURCE_NOT_FOUND,
        `Artifact not found: ${sys_id}`,
        { retryable: false }
      );
    }

    let exportedData: any;

    switch (format) {
      case 'json':
        exportedData = {
          type,
          sys_id: artifact.sys_id,
          name: artifact.name || artifact.id,
          exported_at: new Date().toISOString(),
          data: artifact
        };
        break;

      case 'xml':
        // Convert to XML format
        exportedData = artifactToXML(artifact, type);
        break;

      case 'update_set':
        // Query update set records for this artifact
        const updateSetResponse = await client.get('/api/now/table/sys_update_xml', {
          params: {
            sysparm_query: `target_name=${artifact.sys_id}`,
            sysparm_limit: 10
          }
        });
        exportedData = {
          type,
          sys_id: artifact.sys_id,
          name: artifact.name || artifact.id,
          update_sets: updateSetResponse.data.result
        };
        break;

      default:
        throw new SnowFlowError(
          ErrorType.INVALID_REQUEST,
          `Unsupported format: ${format}`,
          { retryable: false }
        );
    }

    return createSuccessResult(
      {
        artifact: exportedData,
        format,
        table: tableName,
        sys_id,
        name: artifact.name || artifact.id
      },
      {
        message: `✅ Artifact exported successfully\n\nType: ${type}\nFormat: ${format}\nName: ${artifact.name || artifact.id}\nSys ID: ${sys_id}`
      }
    );

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.NETWORK_ERROR, `Export failed: ${error.message}`, { originalError: error })
    );
  }
}

function artifactToXML(artifact: any, type: string): string {
  const xmlParts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  xmlParts.push(`<${type}>`);

  for (const [key, value] of Object.entries(artifact)) {
    if (value !== null && value !== undefined) {
      const escaped = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      xmlParts.push(`  <${key}>${escaped}</${key}>`);
    }
  }

  xmlParts.push(`</${type}>`);
  return xmlParts.join('\n');
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
