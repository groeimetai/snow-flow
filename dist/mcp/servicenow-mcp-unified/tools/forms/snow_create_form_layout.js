"use strict";
/**
 * snow_create_form_layout
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_form_layout',
    description: 'Create custom form layout',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'forms',
    use_cases: ['forms', 'ui', 'layout'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Layout name' },
            table: { type: 'string', description: 'Table name' },
            view: { type: 'string', description: 'Form view' },
            type: { type: 'string', enum: ['standard', 'related_list', 'split'], default: 'standard' }
        },
        required: ['name', 'table']
    }
};
async function execute(args, context) {
    const { name, table, view, type = 'standard' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const layoutData = { name, table, type };
        if (view)
            layoutData.view = view;
        const response = await client.post('/api/now/table/sys_ui_form', layoutData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, layout: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_form_layout.js.map