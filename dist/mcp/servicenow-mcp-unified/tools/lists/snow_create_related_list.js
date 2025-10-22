"use strict";
/**
 * snow_create_related_list
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_related_list',
    description: 'Create related list on form',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'ui',
    use_cases: ['lists', 'relationships', 'forms'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Related list name' },
            parent_table: { type: 'string', description: 'Parent table' },
            related_table: { type: 'string', description: 'Related table' },
            relationship_field: { type: 'string', description: 'Field linking tables' }
        },
        required: ['name', 'parent_table', 'related_table']
    }
};
async function execute(args, context) {
    const { name, parent_table, related_table, relationship_field } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const relatedListData = {
            name,
            parent: parent_table,
            related: related_table
        };
        if (relationship_field)
            relatedListData.relationship = relationship_field;
        const response = await client.post('/api/now/table/sys_ui_related_list', relatedListData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, related_list: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_related_list.js.map