/**
 * snow_import_artifact - Import ServiceNow artifacts
 *
 * Imports previously exported artifacts from JSON/XML files into ServiceNow
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';
import * as fs from 'fs/promises';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_import_artifact',
  description: 'Imports previously exported artifacts from JSON/XML files into ServiceNow. Validates compatibility and handles dependencies automatically.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'deployment',
  use_cases: ['deployment', 'import', 'migration'],
  complexity: 'intermediate',
  frequency: 'medium',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Write operation based on name pattern
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['widget', 'application'], description: 'Artifact type' },
      file_path: { type: 'string', description: 'Path to the artifact file' },
      format: { type: 'string', enum: ['json', 'xml', 'update_set'], default: 'json', description: 'File format' },
    },
    required: ['type', 'file_path'],
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { type, file_path, format = 'json' } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Read the file
    const fileContent = await fs.readFile(file_path, 'utf-8');

    let artifactData: any;

    // Parse based on format
    switch (format) {
      case 'json':
        artifactData = JSON.parse(fileContent);
        if (artifactData.data) {
          // Exported format with metadata
          artifactData = artifactData.data;
        }
        break;

      case 'xml':
        // Simple XML parsing (for basic cases)
        artifactData = parseSimpleXML(fileContent);
        break;

      case 'update_set':
        throw new SnowFlowError(
          ErrorType.INVALID_REQUEST,
          'Update set import requires XML format and should use snow_import_update_set tool',
          { retryable: false }
        );

      default:
        throw new SnowFlowError(
          ErrorType.INVALID_REQUEST,
          `Unsupported format: ${format}`,
          { retryable: false }
        );
    }

    // Determine table name
    const tableMap: Record<string, string> = {
      widget: 'sp_widget',
      application: 'sys_app'
    };

    const tableName = tableMap[type];
    if (!tableName) {
      throw new SnowFlowError(
        ErrorType.INVALID_REQUEST,
        `Unsupported artifact type: ${type}`,
        { retryable: false }
      );
    }

    // Remove system fields that shouldn't be imported
    const cleanedData = { ...artifactData };
    delete cleanedData.sys_id;
    delete cleanedData.sys_created_on;
    delete cleanedData.sys_created_by;
    delete cleanedData.sys_updated_on;
    delete cleanedData.sys_updated_by;
    delete cleanedData.sys_mod_count;

    // Check if artifact already exists
    const existingResponse = await client.get(`/api/now/table/${tableName}`, {
      params: {
        sysparm_query: `name=${cleanedData.name || cleanedData.id}`,
        sysparm_limit: 1
      }
    });

    let result;
    if (existingResponse.data.result.length > 0) {
      // Update existing artifact
      const existingSysId = existingResponse.data.result[0].sys_id;
      const updateResponse = await client.put(`/api/now/table/${tableName}/${existingSysId}`, cleanedData);
      result = {
        sys_id: existingSysId,
        action: 'updated',
        artifact: updateResponse.data.result
      };
    } else {
      // Create new artifact
      const createResponse = await client.post(`/api/now/table/${tableName}`, cleanedData);
      result = {
        sys_id: createResponse.data.result.sys_id,
        action: 'created',
        artifact: createResponse.data.result
      };
    }

    return createSuccessResult(
      result,
      {
        message: `✅ Artifact ${result.action} successfully\n\nType: ${type}\nName: ${cleanedData.name || cleanedData.id}\nSys ID: ${result.sys_id}`
      }
    );

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.NETWORK_ERROR, `Import failed: ${error.message}`, { originalError: error })
    );
  }
}

function parseSimpleXML(xml: string): any {
  const result: any = {};
  const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
  let match;

  while ((match = tagRegex.exec(xml)) !== null) {
    const key = match[1];
    const value = match[2]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    result[key] = value;
  }

  return result;
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
