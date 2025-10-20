"use strict";
/**
 * snow_send_push_notification - Send push notification to mobile devices
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_send_push_notification',
    description: 'Sends a push notification to mobile devices. Can target specific users, groups, or all users.',
    inputSchema: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Notification title'
            },
            message: {
                type: 'string',
                description: 'Notification message'
            },
            target_type: {
                type: 'string',
                description: 'Target type: user, group, all'
            },
            target_id: {
                type: 'string',
                description: 'Target user or group sys_id (if target_type is user or group)'
            },
            priority: {
                type: 'string',
                description: 'Priority: high, normal, low',
                default: 'normal'
            },
            action_type: {
                type: 'string',
                description: 'Action type: open_record, open_url, none'
            },
            action_data: {
                type: 'object',
                description: 'Action data (record sys_id, URL, etc.)'
            },
            sound: {
                type: 'boolean',
                description: 'Play notification sound',
                default: true
            },
            badge: {
                type: 'boolean',
                description: 'Update badge count',
                default: true
            }
        },
        required: ['title', 'message', 'target_type']
    }
};
async function execute(args, context) {
    const { title, message, target_type, target_id, priority = 'normal', action_type, action_data, sound = true, badge = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const notificationData = {
            title,
            message,
            target_type,
            priority,
            sound,
            badge
        };
        if (target_id)
            notificationData.target_id = target_id;
        if (action_type)
            notificationData.action_type = action_type;
        if (action_data)
            notificationData.action_data = JSON.stringify(action_data);
        const response = await client.post('/api/now/table/sys_push_notification', notificationData);
        let recipientCount = 1;
        if (target_type === 'all') {
            recipientCount = 'all';
        }
        else if (target_type === 'group') {
            // Get group member count
            try {
                const groupResponse = await client.get(`/api/now/table/sys_user_grmember?sysparm_query=group=${target_id}&sysparm_limit=1000`);
                recipientCount = groupResponse.data.result?.length || 0;
            }
            catch (err) {
                recipientCount = 'unknown';
            }
        }
        return (0, error_handler_js_1.createSuccessResult)({
            sent: true,
            notification_id: response.data.result.sys_id,
            title,
            target_type,
            recipient_count: recipientCount,
            priority,
            message: `✅ Push notification sent: "${title}" to ${recipientCount} recipient(s)`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_send_push_notification.js.map