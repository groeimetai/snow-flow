"use strict";
/**
 * snow_create_menu_item
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_menu_item',
    description: 'Create menu item',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'ui',
    use_cases: ['menu-items', 'navigation', 'ui-development'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Item title' },
            parent: { type: 'string', description: 'Parent menu sys_id' },
            link_type: { type: 'string', enum: ['list', 'new', 'detail', 'home'], default: 'list' },
            table: { type: 'string', description: 'Target table' },
            order: { type: 'number', description: 'Item order' }
        },
        required: ['title']
    }
};
async function execute(args, context) {
    const { title, parent, link_type = 'list', table, order } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const itemData = { title, link_type };
        if (parent)
            itemData.parent = parent;
        if (table)
            itemData.table = table;
        if (order !== undefined)
            itemData.order = order;
        const response = await client.post('/api/now/table/sys_app_module', itemData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, menu_item: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_menu_item.js.map