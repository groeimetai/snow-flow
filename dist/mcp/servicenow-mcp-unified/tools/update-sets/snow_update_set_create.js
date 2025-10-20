"use strict";
/**
 * snow_update_set_create - Create new Update Set
 *
 * Creates a new Update Set for tracking changes. Essential for ServiceNow
 * change management and deployment tracking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_set_create',
    description: 'Create a new Update Set for tracking ServiceNow changes',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Update Set name (e.g., "STORY-123: Add incident widget")'
            },
            description: {
                type: 'string',
                description: 'Detailed description of changes'
            },
            user_story: {
                type: 'string',
                description: 'User story or ticket number'
            },
            release_date: {
                type: 'string',
                description: 'Target release date (optional)'
            },
            auto_switch: {
                type: 'boolean',
                description: 'Automatically switch to the created Update Set',
                default: true
            }
        },
        required: ['name', 'description']
    }
};
async function execute(args, context) {
    const { name, description, user_story, release_date, auto_switch = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create Update Set
        const response = await client.post('/api/now/table/sys_update_set', {
            name,
            description,
            state: 'in progress',
            application: 'global',
            release_date: release_date || ''
        });
        const updateSet = response.data.result;
        // Auto-switch if requested
        if (auto_switch) {
            await client.put(`/api/now/table/sys_update_set/${updateSet.sys_id}`, {
                is_current: true
            });
        }
        return (0, error_handler_js_1.createSuccessResult)({
            sys_id: updateSet.sys_id,
            name: updateSet.name,
            description: updateSet.description,
            state: 'in progress',
            auto_switched: auto_switch,
            created_at: updateSet.sys_created_on,
            created_by: updateSet.sys_created_by,
            user_story
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_set_create.js.map