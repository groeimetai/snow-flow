/**
 * snow_update_record - Universal record updates
 *
 * Update records in any ServiceNow table with field validation,
 * optimistic locking, and audit trail.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_record',
  description: 'Update a record in any ServiceNow table with validation and audit trail',
  inputSchema: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'Table name'
      },
      sys_id: {
        type: 'string',
        description: 'sys_id of record to update'
      },
      data: {
        type: 'object',
        description: 'Fields to update with new values'
      },
      display_value: {
        type: 'boolean',
        description: 'Return display values',
        default: false
      },
      check_version: {
        type: 'boolean',
        description: 'Perform optimistic locking check (prevents concurrent updates)',
        default: false
      },
      expected_version: {
        type: 'string',
        description: 'Expected sys_mod_count for optimistic locking'
      }
    },
    required: ['table', 'sys_id', 'data']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, sys_id, data, display_value = false, check_version = false, expected_version } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Get current record
    const currentRecord = await client.get(`/api/now/table/${table}/${sys_id}`, {
      params: { sysparm_fields: check_version ? 'sys_id,sys_mod_count' : 'sys_id' }
    });

    if (!currentRecord.data.result) {
      throw new SnowFlowError(
        ErrorType.NOT_FOUND_ERROR,
        `Record not found in table '${table}' with sys_id '${sys_id}'`,
        { details: { table, sys_id } }
      );
    }

    // Optimistic locking check
    if (check_version && expected_version) {
      const currentVersion = currentRecord.data.result.sys_mod_count;
      if (currentVersion !== expected_version) {
        throw new SnowFlowError(
          ErrorType.VALIDATION_ERROR,
          'Record has been modified by another user (optimistic lock conflict)',
          {
            details: {
              expected_version,
              current_version: currentVersion,
              message: 'Refresh and retry the update'
            }
          }
        );
      }
    }

    // Update record
    const response = await client.put(`/api/now/table/${table}/${sys_id}`, data, {
      params: {
        sysparm_display_value: display_value ? 'all' : 'false',
        sysparm_exclude_reference_link: 'true'
      }
    });

    const updatedRecord = response.data.result;

    // Calculate what changed
    const changedFields = Object.keys(data);

    return createSuccessResult({
      updated: true,
      sys_id: updatedRecord.sys_id,
      table,
      record: updatedRecord,
      changed_fields: changedFields,
      new_version: updatedRecord.sys_mod_count,
      display_values: display_value
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
