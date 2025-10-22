"use strict";
/**
 * snow_create_field
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_field',
    description: 'Create table field/column',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'platform',
    use_cases: ['fields', 'schema', 'customization'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            column_name: { type: 'string', description: 'Field name' },
            column_label: { type: 'string', description: 'Field label' },
            internal_type: { type: 'string', description: 'Field type (string, integer, reference, etc.)' },
            reference: { type: 'string', description: 'Reference table (for reference fields)' },
            max_length: { type: 'number', description: 'Maximum length' },
            mandatory: { type: 'boolean', default: false }
        },
        required: ['table', 'column_name', 'internal_type']
    }
};
async function execute(args, context) {
    const { table, column_name, column_label, internal_type, reference, max_length, mandatory = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const fieldData = {
            name: table,
            element: column_name,
            column_label: column_label || column_name,
            internal_type,
            mandatory
        };
        if (reference)
            fieldData.reference = reference;
        if (max_length)
            fieldData.max_length = max_length;
        const response = await client.post('/api/now/table/sys_dictionary', fieldData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, field: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_field.js.map