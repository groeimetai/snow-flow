"use strict";
/**
 * snow_notification_analytics - Notification analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_notification_analytics',
    description: 'Analyze notification delivery rates, engagement, and effectiveness',
    inputSchema: {
        type: 'object',
        properties: {
            analytics_type: {
                type: 'string',
                description: 'Analytics type',
                enum: ['delivery_rates', 'engagement', 'channel_effectiveness', 'template_performance']
            },
            time_period: {
                type: 'string',
                description: 'Analysis time period',
                enum: ['24_hours', '7_days', '30_days', '90_days'],
                default: '7_days'
            },
            channel_filter: {
                type: 'string',
                description: 'Filter by channel'
            },
            template_filter: {
                type: 'string',
                description: 'Filter by template sys_id'
            }
        },
        required: ['analytics_type']
    }
};
async function execute(args, context) {
    const { analytics_type, time_period = '7_days', channel_filter, template_filter } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Calculate date range
        const now = new Date();
        const daysMap = {
            '24_hours': 1,
            '7_days': 7,
            '30_days': 30,
            '90_days': 90
        };
        const startDate = new Date(now.getTime() - (daysMap[time_period] * 24 * 60 * 60 * 1000));
        let query = `sys_created_on>${startDate.toISOString()}`;
        if (channel_filter) {
            query += `^type=${channel_filter}`;
        }
        if (template_filter) {
            query += `^template=${template_filter}`;
        }
        // Get notification records
        const response = await client.get('/api/now/table/sysevent_email_action', {
            params: {
                sysparm_query: query,
                sysparm_fields: 'sys_id,type,state,sys_created_on,template,recipient',
                sysparm_limit: 10000
            }
        });
        const notifications = response.data.result;
        const analytics = {
            analytics_type,
            time_period,
            total_notifications: notifications.length
        };
        if (analytics_type === 'delivery_rates') {
            const sent = notifications.filter((n) => n.state === 'sent' || n.state === 'ready').length;
            const failed = notifications.filter((n) => n.state === 'error').length;
            analytics.delivery_rate = notifications.length > 0
                ? ((sent / notifications.length) * 100).toFixed(2) + '%'
                : '0%';
            analytics.sent = sent;
            analytics.failed = failed;
        }
        if (analytics_type === 'channel_effectiveness') {
            const byChannel = {};
            notifications.forEach((n) => {
                const channel = n.type || 'email';
                byChannel[channel] = (byChannel[channel] || 0) + 1;
            });
            analytics.by_channel = byChannel;
        }
        if (analytics_type === 'template_performance') {
            const byTemplate = {};
            notifications.forEach((n) => {
                const template = n.template || 'none';
                byTemplate[template] = (byTemplate[template] || 0) + 1;
            });
            analytics.by_template = byTemplate;
        }
        return (0, error_handler_js_1.createSuccessResult)(analytics);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_notification_analytics.js.map