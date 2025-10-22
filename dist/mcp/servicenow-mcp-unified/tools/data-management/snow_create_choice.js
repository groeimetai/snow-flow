"use strict";
/**
 * snow_create_choice
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_choice',
    description: 'Create choice list value for field',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'platform',
    use_cases: ['choices', 'fields', 'customization'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            element: { type: 'string', description: 'Field name' },
            value: { type: 'string', description: 'Choice value' },
            label: { type: 'string', description: 'Choice label' },
            sequence: { type: 'number', description: 'Display order' },
            inactive: { type: 'boolean', default: false }
        },
        required: ['table', 'element', 'value', 'label']
    }
};
async function execute(args, context) {
    const { table, element, value, label, sequence, inactive = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const choiceData = { name: table, element, value, label, inactive };
        if (sequence !== undefined)
            choiceData.sequence = sequence;
        const response = await client.post('/api/now/table/sys_choice', choiceData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, choice: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_choice.js.map