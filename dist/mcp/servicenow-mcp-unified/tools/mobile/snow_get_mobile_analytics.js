"use strict";
/**
 * snow_get_mobile_analytics - Get mobile analytics data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_mobile_analytics',
    description: 'Retrieves mobile application usage analytics including active users, sessions, and feature usage.',
    inputSchema: {
        type: 'object',
        properties: {
            metric_type: {
                type: 'string',
                description: 'Metric type: users, sessions, features, performance, errors, all'
            },
            time_range: {
                type: 'string',
                description: 'Time range: 24h, 7d, 30d, 90d'
            },
            user_id: {
                type: 'string',
                description: 'Filter by specific user'
            },
            platform: {
                type: 'string',
                description: 'Filter by platform: ios, android, all'
            }
        }
    }
};
async function execute(args, context) {
    const { metric_type = 'all', time_range = '7d', user_id, platform } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Calculate date range
        const now = new Date();
        const daysMap = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[time_range] || 7;
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        let queryFilter = `sys_created_on>=${startDate.toISOString()}`;
        if (user_id)
            queryFilter += `^user=${user_id}`;
        if (platform && platform !== 'all')
            queryFilter += `^platform=${platform}`;
        const analytics = {
            time_range,
            start_date: startDate.toISOString(),
            end_date: now.toISOString()
        };
        // Fetch mobile analytics data
        try {
            const response = await client.get(`/api/now/table/sys_mobile_analytics?sysparm_query=${queryFilter}&sysparm_limit=1000`);
            const records = response.data.result || [];
            // Aggregate analytics
            analytics.total_sessions = records.length;
            analytics.unique_users = new Set(records.map((r) => r.user)).size;
            if (platform === 'all' || !platform) {
                analytics.by_platform = {
                    ios: records.filter((r) => r.platform === 'ios').length,
                    android: records.filter((r) => r.platform === 'android').length
                };
            }
            // Calculate average session duration
            const durations = records
                .filter((r) => r.duration)
                .map((r) => parseInt(r.duration));
            if (durations.length > 0) {
                analytics.avg_session_duration_seconds =
                    durations.reduce((a, b) => a + b, 0) / durations.length;
            }
            // Feature usage
            const features = records.reduce((acc, r) => {
                if (r.feature) {
                    acc[r.feature] = (acc[r.feature] || 0) + 1;
                }
                return acc;
            }, {});
            analytics.feature_usage = features;
            return (0, error_handler_js_1.createSuccessResult)({
                analytics,
                message: `📊 Mobile analytics for ${time_range}: ${analytics.total_sessions} sessions, ${analytics.unique_users} users`
            });
        }
        catch (err) {
            // Analytics table might not exist, return simulated data
            return (0, error_handler_js_1.createSuccessResult)({
                analytics: {
                    ...analytics,
                    total_sessions: 0,
                    unique_users: 0,
                    note: 'Mobile analytics table not available in this instance'
                },
                message: '⚠️ Mobile analytics data not available'
            });
        }
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_mobile_analytics.js.map