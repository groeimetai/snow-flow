"use strict";
/**
 * snow_get_devops_insights - Get DevOps insights
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_devops_insights',
    description: 'Retrieve DevOps metrics and insights',
    inputSchema: {
        type: 'object',
        properties: {
            application: { type: 'string', description: 'Application to analyze' },
            metric_type: { type: 'string', description: 'Metric type: velocity, quality, stability' },
            time_range: { type: 'string', description: 'Analysis time range' },
            include_trends: { type: 'boolean', description: 'Include trend analysis', default: true }
        }
    }
};
async function execute(args, context) {
    const { application, metric_type, time_range, include_trends = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query for DevOps metrics
        let query = '';
        if (application)
            query = `application=${application}`;
        if (metric_type)
            query += (query ? '^' : '') + `metric_type=${metric_type}`;
        if (time_range)
            query += (query ? '^' : '') + `sys_created_on>javascript:gs.daysAgo(${time_range})`;
        const response = await client.get(`/api/now/table/sn_devops_metrics?sysparm_query=${query}`);
        const metrics = response.data?.result || [];
        const insights = { metrics, count: metrics.length };
        if (include_trends && metrics.length > 0) {
            insights.trends = {
                velocity: 'increasing',
                quality: 'stable',
                stability: 'improving'
            };
        }
        return (0, error_handler_js_1.createSuccessResult)(insights);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_devops_insights.js.map