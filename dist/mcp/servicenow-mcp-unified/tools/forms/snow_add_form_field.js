"use strict";
/**
 * snow_add_form_field
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_add_form_field',
    description: 'Add field to form section',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'forms',
    use_cases: ['forms', 'ui', 'fields'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            section_sys_id: { type: 'string', description: 'Section sys_id' },
            element: { type: 'string', description: 'Field name' },
            type: { type: 'string', description: 'Field type' },
            position: { type: 'number', description: 'Field position' }
        },
        required: ['section_sys_id', 'element']
    }
};
async function execute(args, context) {
    const { section_sys_id, element, type, position } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const fieldData = {
            sys_ui_section: section_sys_id,
            element
        };
        if (type)
            fieldData.type = type;
        if (position !== undefined)
            fieldData.position = position;
        const response = await client.post('/api/now/table/sys_ui_element', fieldData);
        return (0, error_handler_js_1.createSuccessResult)({ added: true, field: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_add_form_field.js.map