"use strict";
/**
 * snow_get_event_correlation - Get event correlation results
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_event_correlation',
    description: 'Get event correlation results showing how events are grouped into alerts',
    inputSchema: {
        type: 'object',
        properties: {
            alert_id: { type: 'string', description: 'Alert sys_id to analyze' },
            time_range: { type: 'string', description: 'Time range to check (e.g., "24 hours", "7 days")' },
            include_suppressed: { type: 'boolean', description: 'Include suppressed events', default: false }
        }
    }
};
async function execute(args, context) {
    const { alert_id, time_range, include_suppressed = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let result = {};
        // If alert_id provided, get specific alert correlation
        if (alert_id) {
            const alertResponse = await client.get(`/api/now/table/em_alert/${alert_id}`);
            const alert = alertResponse.data.result;
            if (!alert) {
                return (0, error_handler_js_1.createErrorResult)('Alert not found');
            }
            // Get correlated events for this alert
            const eventQuery = `alert=${alert_id}${include_suppressed ? '' : '^suppressed=false'}`;
            const eventsResponse = await client.get(`/api/now/table/em_event?sysparm_query=${eventQuery}&sysparm_limit=100`);
            const events = eventsResponse.data.result || [];
            result = {
                alert: {
                    sys_id: alert.sys_id,
                    number: alert.number,
                    severity: alert.severity,
                    state: alert.state,
                    description: alert.description
                },
                correlated_events: events.length,
                suppressed_events: events.filter((e) => e.suppressed === 'true').length,
                events: events.map((e) => ({
                    sys_id: e.sys_id,
                    number: e.number,
                    type: e.type,
                    severity: e.severity,
                    node: e.node?.display_value || e.node,
                    time_of_event: e.time_of_event,
                    suppressed: e.suppressed === 'true'
                }))
            };
        }
        else {
            // Get recent correlation statistics
            let query = 'state=Active';
            if (time_range) {
                const hoursMatch = time_range.match(/(\d+)\s*hours?/i);
                const daysMatch = time_range.match(/(\d+)\s*days?/i);
                if (hoursMatch) {
                    const hours = parseInt(hoursMatch[1]);
                    query += `^sys_created_on>javascript:gs.hoursAgo(${hours})`;
                }
                else if (daysMatch) {
                    const days = parseInt(daysMatch[1]);
                    query += `^sys_created_on>javascript:gs.daysAgo(${days})`;
                }
            }
            const alertsResponse = await client.get(`/api/now/table/em_alert?sysparm_query=${query}&sysparm_limit=50`);
            const alerts = alertsResponse.data.result || [];
            // Get correlation rules applied
            const rulesResponse = await client.get(`/api/now/table/em_alert_rule?sysparm_query=active=true&sysparm_limit=50`);
            const rules = rulesResponse.data.result || [];
            result = {
                summary: {
                    active_alerts: alerts.length,
                    time_range: time_range || 'All time',
                    correlation_rules_active: rules.length
                },
                alerts: alerts.map((a) => ({
                    sys_id: a.sys_id,
                    number: a.number,
                    severity: a.severity,
                    description: a.description,
                    event_count: a.event_count || 0
                })),
                correlation_rules: rules.map((r) => ({
                    name: r.name,
                    condition: r.condition,
                    active: r.active === 'true'
                }))
            };
        }
        return (0, error_handler_js_1.createSuccessResult)(result);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_event_correlation.js.map