"use strict";
/**
 * snow_create_list_view
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_list_view',
    description: 'Create custom list view',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'ui',
    use_cases: ['lists', 'views', 'ui-customization'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'View name' },
            table: { type: 'string', description: 'Table name' },
            fields: { type: 'array', items: { type: 'string' }, description: 'Fields to display' },
            filter: { type: 'string', description: 'Default filter' }
        },
        required: ['name', 'table']
    }
};
async function execute(args, context) {
    const { name, table, fields, filter } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const viewData = { name, title: table };
        if (fields)
            viewData.fields = fields.join(',');
        if (filter)
            viewData.filter = filter;
        const response = await client.post('/api/now/table/sys_ui_list', viewData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, view: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_list_view.js.map