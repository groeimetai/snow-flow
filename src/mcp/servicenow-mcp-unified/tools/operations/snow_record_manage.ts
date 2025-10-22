/**
 * snow_record_manage - Unified Record Management
 *
 * Comprehensive CRUD operations for any ServiceNow table with validation,
 * optimistic locking, dependency checking, and soft delete support.
 *
 * Replaces: snow_create_record, snow_update_record, snow_delete_record
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_record_manage',
  description: 'Unified record management (create, update, delete) with validation',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'crud',
  use_cases: ['create', 'update', 'delete', 'records'],
  complexity: 'intermediate',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'CRUD action to perform',
        enum: ['create', 'update', 'delete']
      },
      table: {
        type: 'string',
        description: 'Table name (e.g., "incident", "change_request")'
      },
      // CREATE/UPDATE parameters
      data: {
        type: 'object',
        description: '[create/update] Field values for the record'
      },
      display_value: {
        type: 'boolean',
        description: '[create/update] Return display values instead of sys_ids',
        default: false
      },
      // CREATE parameters
      validate_references: {
        type: 'boolean',
        description: '[create] Validate reference fields exist before creation',
        default: true
      },
      // UPDATE/DELETE parameters
      sys_id: {
        type: 'string',
        description: '[update/delete] sys_id of record to modify'
      },
      // UPDATE parameters
      check_version: {
        type: 'boolean',
        description: '[update] Perform optimistic locking check',
        default: false
      },
      expected_version: {
        type: 'string',
        description: '[update] Expected sys_mod_count for optimistic locking'
      },
      // DELETE parameters
      check_references: {
        type: 'boolean',
        description: '[delete] Check for dependent records before deletion',
        default: true
      },
      soft_delete: {
        type: 'boolean',
        description: '[delete] Mark as deleted instead of hard delete',
        default: false
      },
      force: {
        type: 'boolean',
        description: '[delete] Force deletion even with dependencies',
        default: false
      }
    },
    required: ['action', 'table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { action } = args;

  try {
    switch (action) {
      case 'create':
        return await executeCreate(args, context);
      case 'update':
        return await executeUpdate(args, context);
      case 'delete':
        return await executeDelete(args, context);
      default:
        return createErrorResult(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

// ==================== CREATE ====================
async function executeCreate(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, data, display_value = false, validate_references = true } = args;

  if (!data) {
    return createErrorResult('data is required for create action');
  }

  const client = await getAuthenticatedClient(context);

  // Validate table exists
  const tableCheck = await client.get(`/api/now/table/sys_db_object`, {
    params: {
      sysparm_query: `name=${table}`,
      sysparm_fields: 'name,label',
      sysparm_limit: 1
    }
  });

  if (!tableCheck.data.result || tableCheck.data.result.length === 0) {
    throw new SnowFlowError(
      ErrorType.VALIDATION_ERROR,
      `Table '${table}' does not exist`,
      { details: { table } }
    );
  }

  // Validate reference fields if requested
  if (validate_references) {
    const fields = await client.get(`/api/now/table/sys_dictionary`, {
      params: {
        sysparm_query: `name=${table}^internal_type=reference`,
        sysparm_fields: 'element,reference',
        sysparm_limit: 1000
      }
    });

    for (const field of fields.data.result || []) {
      const fieldName = field.element;
      const referenceTable = field.reference;

      if (data[fieldName]) {
        // Validate reference exists
        const refCheck = await client.get(`/api/now/table/${referenceTable}/${data[fieldName]}`, {
          params: { sysparm_fields: 'sys_id' }
        });

        if (!refCheck.data.result) {
          throw new SnowFlowError(
            ErrorType.VALIDATION_ERROR,
            `Reference '${fieldName}' points to non-existent record in '${referenceTable}'`,
            { details: { field: fieldName, value: data[fieldName], table: referenceTable } }
          );
        }
      }
    }
  }

  // Create record
  const response = await client.post(`/api/now/table/${table}`, data, {
    params: {
      sysparm_display_value: display_value ? 'all' : 'false',
      sysparm_exclude_reference_link: 'true'
    }
  });

  const record = response.data.result;

  return createSuccessResult({
    action: 'create',
    created: true,
    sys_id: record.sys_id,
    table,
    record,
    display_values: display_value
  });
}

// ==================== UPDATE ====================
async function executeUpdate(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, sys_id, data, display_value = false, check_version = false, expected_version } = args;

  if (!sys_id) {
    return createErrorResult('sys_id is required for update action');
  }

  if (!data) {
    return createErrorResult('data is required for update action');
  }

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
    action: 'update',
    updated: true,
    sys_id: updatedRecord.sys_id,
    table,
    record: updatedRecord,
    changed_fields: changedFields,
    new_version: updatedRecord.sys_mod_count,
    display_values: display_value
  });
}

// ==================== DELETE ====================
async function executeDelete(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, sys_id, check_references = true, soft_delete = false, force = false } = args;

  if (!sys_id) {
    return createErrorResult('sys_id is required for delete action');
  }

  const client = await getAuthenticatedClient(context);

  // Get record to verify existence
  const recordCheck = await client.get(`/api/now/table/${table}/${sys_id}`, {
    params: { sysparm_fields: 'sys_id' }
  });

  if (!recordCheck.data.result) {
    throw new SnowFlowError(
      ErrorType.NOT_FOUND_ERROR,
      `Record not found in table '${table}' with sys_id '${sys_id}'`,
      { details: { table, sys_id } }
    );
  }

  // Check for dependencies
  let dependencies: any[] = [];
  if (check_references && !force) {
    // Find all tables that reference this table
    const refFieldsResponse = await client.get(`/api/now/table/sys_dictionary`, {
      params: {
        sysparm_query: `reference=${table}^internal_type=reference`,
        sysparm_fields: 'name,element',
        sysparm_limit: 1000
      }
    });

    for (const refField of refFieldsResponse.data.result || []) {
      const refTable = refField.name;
      const refColumn = refField.element;

      // Check if any records reference this record
      const dependentRecords = await client.get(`/api/now/table/${refTable}`, {
        params: {
          sysparm_query: `${refColumn}=${sys_id}`,
          sysparm_fields: 'sys_id,number',
          sysparm_limit: 5
        }
      });

      if (dependentRecords.data.result && dependentRecords.data.result.length > 0) {
        dependencies.push({
          table: refTable,
          field: refColumn,
          count: dependentRecords.data.result.length,
          sample_records: dependentRecords.data.result.map((r: any) => ({
            sys_id: r.sys_id,
            number: r.number || r.sys_id
          }))
        });
      }
    }

    if (dependencies.length > 0 && !force) {
      throw new SnowFlowError(
        ErrorType.VALIDATION_ERROR,
        'Cannot delete record with dependencies. Use force=true to override.',
        {
          details: {
            dependencies,
            total_dependent_tables: dependencies.length,
            suggestion: 'Review dependencies or use soft_delete=true'
          }
        }
      );
    }
  }

  // Perform deletion
  if (soft_delete) {
    // Check if table has active field
    const hasActiveField = await client.get(`/api/now/table/sys_dictionary`, {
      params: {
        sysparm_query: `name=${table}^element=active`,
        sysparm_fields: 'element',
        sysparm_limit: 1
      }
    });

    if (hasActiveField.data.result && hasActiveField.data.result.length > 0) {
      // Soft delete by setting active=false
      await client.put(`/api/now/table/${table}/${sys_id}`, {
        active: 'false'
      });

      return createSuccessResult({
        action: 'delete',
        deleted: true,
        soft_delete: true,
        sys_id,
        table,
        message: 'Record marked as inactive (soft delete)',
        dependencies_found: dependencies.length > 0,
        dependencies
      });
    } else {
      throw new SnowFlowError(
        ErrorType.VALIDATION_ERROR,
        `Table '${table}' does not support soft delete (no 'active' field)`,
        { details: { table } }
      );
    }
  } else {
    // Hard delete
    await client.delete(`/api/now/table/${table}/${sys_id}`);

    return createSuccessResult({
      action: 'delete',
      deleted: true,
      soft_delete: false,
      sys_id,
      table,
      message: 'Record permanently deleted',
      dependencies_found: dependencies.length > 0,
      dependencies,
      forced: force && dependencies.length > 0
    });
  }
}

export const version = '2.0.0';
export const author = 'Snow-Flow v8.2.0 Tool Merging - Phase 1';
