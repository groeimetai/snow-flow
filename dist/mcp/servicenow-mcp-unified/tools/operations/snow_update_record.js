"use strict";
/**
 * snow_update_record - Universal record updates
 *
 * Update records in any ServiceNow table with field validation,
 * optimistic locking, and audit trail.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_record',
    description: 'Update a record in any ServiceNow table with validation and audit trail',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'crud',
    use_cases: ['update', 'records'],
    complexity: 'intermediate',
    frequency: 'high',
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
async function execute(args, context) {
    const { table, sys_id, data, display_value = false, check_version = false, expected_version } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get current record
        const currentRecord = await client.get(`/api/now/table/${table}/${sys_id}`, {
            params: { sysparm_fields: check_version ? 'sys_id,sys_mod_count' : 'sys_id' }
        });
        if (!currentRecord.data.result) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NOT_FOUND_ERROR, `Record not found in table '${table}' with sys_id '${sys_id}'`, { details: { table, sys_id } });
        }
        // Optimistic locking check
        if (check_version && expected_version) {
            const currentVersion = currentRecord.data.result.sys_mod_count;
            if (currentVersion !== expected_version) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, 'Record has been modified by another user (optimistic lock conflict)', {
                    details: {
                        expected_version,
                        current_version: currentVersion,
                        message: 'Refresh and retry the update'
                    }
                });
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
        return (0, error_handler_js_1.createSuccessResult)({
            updated: true,
            sys_id: updatedRecord.sys_id,
            table,
            record: updatedRecord,
            changed_fields: changedFields,
            new_version: updatedRecord.sys_mod_count,
            display_values: display_value
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_record.js.map