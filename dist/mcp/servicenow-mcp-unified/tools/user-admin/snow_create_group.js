"use strict";
/**
 * snow_create_group
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_group',
    description: 'Create user group',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'user-admin',
    use_cases: ['groups', 'user-admin', 'organization'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Group name' },
            description: { type: 'string', description: 'Group description' },
            manager: { type: 'string', description: 'Manager sys_id' },
            type: { type: 'string', description: 'Group type' },
            active: { type: 'boolean', default: true }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, description, manager, type, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const groupData = { name, active };
        if (description)
            groupData.description = description;
        if (manager)
            groupData.manager = manager;
        if (type)
            groupData.type = type;
        const response = await client.post('/api/now/table/sys_user_group', groupData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, group: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_group.js.map