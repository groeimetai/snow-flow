"use strict";
/**
 * snow_create_form_section
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_form_section',
    description: 'Create form section',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'forms',
    use_cases: ['forms', 'ui', 'sections'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Section name' },
            table: { type: 'string', description: 'Table name' },
            view: { type: 'string', description: 'Form view' },
            caption: { type: 'string', description: 'Section caption' },
            position: { type: 'number', description: 'Section position' }
        },
        required: ['name', 'table']
    }
};
async function execute(args, context) {
    const { name, table, view, caption, position } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const sectionData = { name, table };
        if (view)
            sectionData.view = view;
        if (caption)
            sectionData.caption = caption;
        if (position !== undefined)
            sectionData.position = position;
        const response = await client.post('/api/now/table/sys_ui_section', sectionData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, section: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_form_section.js.map