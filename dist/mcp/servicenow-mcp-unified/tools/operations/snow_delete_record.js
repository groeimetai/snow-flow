"use strict";
/**
 * snow_delete_record - Safe record deletion
 *
 * Delete records with safety checks, dependency validation, and
 * optional soft delete capability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_delete_record',
    description: 'Safely delete a record with dependency checks and optional soft delete',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'crud',
    use_cases: ['delete', 'records'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'Table name'
            },
            sys_id: {
                type: 'string',
                description: 'sys_id of record to delete'
            },
            check_references: {
                type: 'boolean',
                description: 'Check for dependent records before deletion',
                default: true
            },
            soft_delete: {
                type: 'boolean',
                description: 'Mark as deleted instead of hard delete (if table supports it)',
                default: false
            },
            force: {
                type: 'boolean',
                description: 'Force deletion even with dependencies',
                default: false
            }
        },
        required: ['table', 'sys_id']
    }
};
async function execute(args, context) {
    const { table, sys_id, check_references = true, soft_delete = false, force = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get record to verify existence
        const recordCheck = await client.get(`/api/now/table/${table}/${sys_id}`, {
            params: { sysparm_fields: 'sys_id' }
        });
        if (!recordCheck.data.result) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NOT_FOUND_ERROR, `Record not found in table '${table}' with sys_id '${sys_id}'`, { details: { table, sys_id } });
        }
        // Check for dependencies
        let dependencies = [];
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
                        sample_records: dependentRecords.data.result.map((r) => ({
                            sys_id: r.sys_id,
                            number: r.number || r.sys_id
                        }))
                    });
                }
            }
            if (dependencies.length > 0 && !force) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, 'Cannot delete record with dependencies. Use force=true to override.', {
                    details: {
                        dependencies,
                        total_dependent_tables: dependencies.length,
                        suggestion: 'Review dependencies or use soft_delete=true'
                    }
                });
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
                return (0, error_handler_js_1.createSuccessResult)({
                    deleted: true,
                    soft_delete: true,
                    sys_id,
                    table,
                    message: 'Record marked as inactive (soft delete)',
                    dependencies_found: dependencies.length > 0,
                    dependencies
                });
            }
            else {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, `Table '${table}' does not support soft delete (no 'active' field)`, { details: { table } });
            }
        }
        else {
            // Hard delete
            await client.delete(`/api/now/table/${table}/${sys_id}`);
            return (0, error_handler_js_1.createSuccessResult)({
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
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_delete_record.js.map