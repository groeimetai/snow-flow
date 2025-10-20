"use strict";
/**
 * snow_notification_preferences - Manage notification preferences
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_notification_preferences',
    description: 'Manage user notification preferences and routing rules',
    inputSchema: {
        type: 'object',
        properties: {
            user_id: {
                type: 'string',
                description: 'User sys_id'
            },
            action: {
                type: 'string',
                description: 'Action to perform',
                enum: ['get', 'set', 'update']
            },
            preferences: {
                type: 'object',
                description: 'User notification preferences',
                properties: {
                    email_enabled: { type: 'boolean' },
                    sms_enabled: { type: 'boolean' },
                    push_enabled: { type: 'boolean' },
                    quiet_hours_start: { type: 'string', description: 'HH:MM format' },
                    quiet_hours_end: { type: 'string', description: 'HH:MM format' }
                }
            }
        },
        required: ['user_id', 'action']
    }
};
async function execute(args, context) {
    const { user_id, action, preferences = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        if (action === 'get') {
            // Get user notification preferences
            const response = await client.get('/api/now/table/sys_user_preference', {
                params: {
                    sysparm_query: `user=${user_id}^nameLIKEnotification`,
                    sysparm_fields: 'name,value'
                }
            });
            const prefs = response.data.result;
            const userPrefs = {};
            prefs.forEach((p) => {
                userPrefs[p.name] = p.value;
            });
            return (0, error_handler_js_1.createSuccessResult)({
                user_id,
                preferences: userPrefs
            });
        }
        if (action === 'set' || action === 'update') {
            // Set/update user preferences
            const updates = [];
            for (const [key, value] of Object.entries(preferences)) {
                const prefName = `notification.${key}`;
                // Check if preference exists
                const existingResponse = await client.get('/api/now/table/sys_user_preference', {
                    params: {
                        sysparm_query: `user=${user_id}^name=${prefName}`,
                        sysparm_limit: 1
                    }
                });
                if (existingResponse.data.result.length > 0) {
                    // Update existing
                    const prefSysId = existingResponse.data.result[0].sys_id;
                    await client.patch(`/api/now/table/sys_user_preference/${prefSysId}`, {
                        value: String(value)
                    });
                }
                else {
                    // Create new
                    await client.post('/api/now/table/sys_user_preference', {
                        user: user_id,
                        name: prefName,
                        value: String(value)
                    });
                }
                updates.push({ name: prefName, value });
            }
            return (0, error_handler_js_1.createSuccessResult)({
                updated: true,
                user_id,
                changes: updates
            });
        }
        return (0, error_handler_js_1.createErrorResult)(`Unknown action: ${action}`);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_notification_preferences.js.map