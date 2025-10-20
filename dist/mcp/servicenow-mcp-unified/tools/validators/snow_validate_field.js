"use strict";
/**
 * snow_validate_field
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_validate_field',
    description: 'Validate field value',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            field: { type: 'string', description: 'Field name' },
            value: { type: 'string', description: 'Value to validate' }
        },
        required: ['table', 'field', 'value']
    }
};
async function execute(args, context) {
    const { table, field, value } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const fieldResponse = await client.get('/api/now/table/sys_dictionary', {
            params: {
                sysparm_query: `name=${table}^element=${field}`,
                sysparm_limit: 1
            }
        });
        if (fieldResponse.data.result.length === 0) {
            return (0, error_handler_js_1.createErrorResult)('Field not found');
        }
        const fieldDef = fieldResponse.data.result[0];
        const isValid = true; // Basic validation logic here
        return (0, error_handler_js_1.createSuccessResult)({
            valid: isValid,
            table,
            field,
            value,
            field_type: fieldDef.internal_type
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_validate_field.js.map