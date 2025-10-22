"use strict";
/**
 * snow_add_list_column
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_add_list_column',
    description: 'Add column to list view',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'ui',
    use_cases: ['lists', 'views', 'ui-customization'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            element: { type: 'string', description: 'Field name' },
            position: { type: 'number', description: 'Column position' },
            width: { type: 'number', description: 'Column width' }
        },
        required: ['table', 'element']
    }
};
async function execute(args, context) {
    const { table, element, position, width } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const columnData = { name: table, element };
        if (position !== undefined)
            columnData.position = position;
        if (width)
            columnData.width = width;
        const response = await client.post('/api/now/table/sys_ui_list_element', columnData);
        return (0, error_handler_js_1.createSuccessResult)({ added: true, column: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_add_list_column.js.map