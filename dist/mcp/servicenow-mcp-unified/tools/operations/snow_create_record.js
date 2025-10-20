"use strict";
/**
 * snow_create_record - Universal record creation
 *
 * Create records in any ServiceNow table with field validation and
 * reference resolution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_record',
    description: 'Create a record in any ServiceNow table with field validation',
    inputSchema: {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'Table name (e.g., "incident", "change_request")'
            },
            data: {
                type: 'object',
                description: 'Field values for the new record'
            },
            display_value: {
                type: 'boolean',
                description: 'Return display values instead of sys_ids',
                default: false
            },
            validate_references: {
                type: 'boolean',
                description: 'Validate reference fields exist before creation',
                default: true
            }
        },
        required: ['table', 'data']
    }
};
async function execute(args, context) {
    const { table, data, display_value = false, validate_references = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Validate table exists
        const tableCheck = await client.get(`/api/now/table/sys_db_object`, {
            params: {
                sysparm_query: `name=${table}`,
                sysparm_fields: 'name,label',
                sysparm_limit: 1
            }
        });
        if (!tableCheck.data.result || tableCheck.data.result.length === 0) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, `Table '${table}' does not exist`, { details: { table } });
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
                        throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, `Reference '${fieldName}' points to non-existent record in '${referenceTable}'`, { details: { field: fieldName, value: data[fieldName], table: referenceTable } });
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
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            sys_id: record.sys_id,
            table,
            record,
            display_values: display_value
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_record.js.map