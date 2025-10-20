"use strict";
/**
 * snow_create_mobile_action - Create mobile action
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_mobile_action',
    description: 'Creates a mobile action that users can trigger from the mobile app. Actions can navigate, execute scripts, or open forms.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Action name'
            },
            label: {
                type: 'string',
                description: 'Action label displayed to users'
            },
            table: {
                type: 'string',
                description: 'Table this action applies to'
            },
            action_type: {
                type: 'string',
                description: 'Action type: navigate, script, form, workflow'
            },
            icon: {
                type: 'string',
                description: 'Icon name for the action'
            },
            script: {
                type: 'string',
                description: 'Script to execute (for script type)'
            },
            target_url: {
                type: 'string',
                description: 'Target URL (for navigate type)'
            },
            condition: {
                type: 'string',
                description: 'Condition script for action visibility'
            },
            order: {
                type: 'number',
                description: 'Display order',
                default: 100
            }
        },
        required: ['name', 'label', 'table', 'action_type']
    }
};
async function execute(args, context) {
    const { name, label, table, action_type, icon, script, target_url, condition, order = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const actionData = {
            name,
            label,
            table,
            action_type,
            order
        };
        if (icon)
            actionData.icon = icon;
        if (script)
            actionData.script = script;
        if (target_url)
            actionData.target_url = target_url;
        if (condition)
            actionData.condition = condition;
        const response = await client.post('/api/now/table/sys_ui_mobile_action', actionData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            action: response.data.result,
            name,
            table,
            action_type,
            message: `✅ Mobile action created: ${label}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_mobile_action.js.map