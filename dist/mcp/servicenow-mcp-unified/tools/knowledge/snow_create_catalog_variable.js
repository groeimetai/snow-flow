"use strict";
/**
 * snow_create_catalog_variable - Catalog item variable
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_catalog_variable',
    description: 'Create catalog item variable',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'service-catalog',
    use_cases: ['catalog', 'variables', 'forms'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            cat_item: { type: 'string' },
            name: { type: 'string' },
            question_text: { type: 'string' },
            type: { type: 'string', enum: ['single_line_text', 'multi_line_text', 'multiple_choice', 'select_box'] }
        },
        required: ['cat_item', 'name', 'question_text', 'type']
    }
};
async function execute(args, context) {
    const { cat_item, name, question_text, type } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post('/api/now/table/item_option_new', {
            cat_item, name, question_text, type
        });
        return (0, error_handler_js_1.createSuccessResult)({ created: true, variable: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_catalog_variable.js.map