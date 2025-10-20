"use strict";
/**
 * snow_monitor_metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_monitor_metrics',
    description: 'Monitor system metrics and performance indicators',
    inputSchema: {
        type: 'object',
        properties: {
            metric_type: { type: 'string', enum: ['cpu', 'memory', 'database', 'transactions'], description: 'Metric type' },
            time_range: { type: 'string', description: 'Time range for metrics' }
        },
        required: ['metric_type']
    }
};
async function execute(args, context) {
    const { metric_type, time_range = '1hour' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/metric', {
            params: {
                sysparm_query: `type=${metric_type}^created_at>javascript:gs.hoursAgo(1)`,
                sysparm_limit: 100
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({ metrics: response.data.result, metric_type, time_range });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_monitor_metrics.js.map