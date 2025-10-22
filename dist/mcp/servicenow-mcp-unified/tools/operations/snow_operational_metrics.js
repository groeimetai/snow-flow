"use strict";
/**
 * snow_operational_metrics - Get operational metrics
 *
 * Provides operational metrics and analytics including incident trends, resolution times, and performance indicators.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_operational_metrics',
    description: 'Provides operational metrics and analytics including incident trends, resolution times, and performance indicators',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ml-analytics',
    subcategory: 'metrics',
    use_cases: ['analytics', 'metrics'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            timeframe: {
                type: 'string',
                description: 'Time period for metrics',
                enum: ['today', 'week', 'month', 'quarter'],
                default: 'week'
            },
            metric_types: {
                type: 'array',
                items: { type: 'string' },
                description: 'Types of metrics to include (leave empty for all)',
                examples: [['incidents', 'requests', 'problems']]
            }
        }
    }
};
function getDateFilter(timeframe) {
    switch (timeframe) {
        case 'today':
            return 'ONToday@javascript:gs.daysAgoStart(0)@javascript:gs.daysAgoEnd(0)';
        case 'week':
            return 'ONLast 7 days@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)';
        case 'month':
            return 'ONLast 30 days@javascript:gs.daysAgoStart(30)@javascript:gs.daysAgoEnd(0)';
        case 'quarter':
            return 'ONLast 90 days@javascript:gs.daysAgoStart(90)@javascript:gs.daysAgoEnd(0)';
        default:
            return 'ONLast 7 days@javascript:gs.daysAgoStart(7)@javascript:gs.daysAgoEnd(0)';
    }
}
async function execute(args, context) {
    const { timeframe = 'week', metric_types = [] } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const dateFilter = getDateFilter(timeframe);
        const metrics = {
            timeframe,
            generated_at: new Date().toISOString()
        };
        const includeAll = metric_types.length === 0;
        // Get incident metrics
        if (includeAll || metric_types.includes('incidents')) {
            // Total incidents
            const totalIncidents = await client.get('/api/now/table/incident', {
                params: {
                    sysparm_query: `sys_created_on${dateFilter}`,
                    sysparm_limit: 1000,
                    sysparm_fields: 'number,state,priority,category'
                }
            });
            const incidents = totalIncidents.data.result || [];
            // Open incidents
            const openIncidents = incidents.filter((inc) => inc.state !== '6' && inc.state !== '7');
            // High priority incidents
            const highPriorityIncidents = incidents.filter((inc) => inc.priority === '1');
            // Category distribution
            const categories = new Map();
            incidents.forEach((inc) => {
                const cat = inc.category || 'uncategorized';
                categories.set(cat, (categories.get(cat) || 0) + 1);
            });
            metrics.incidents = {
                total: incidents.length,
                open: openIncidents.length,
                high_priority: highPriorityIncidents.length,
                common_categories: Array.from(categories.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([category, count]) => ({ category, count }))
            };
        }
        // Get request metrics
        if (includeAll || metric_types.includes('requests')) {
            const requests = await client.get('/api/now/table/sc_request', {
                params: {
                    sysparm_query: `sys_created_on${dateFilter}`,
                    sysparm_limit: 1000,
                    sysparm_fields: 'number,request_state,approval'
                }
            });
            const requestData = requests.data.result || [];
            const openRequests = requestData.filter((req) => req.request_state !== 'closed');
            const pendingApproval = requestData.filter((req) => req.approval === 'requested');
            metrics.requests = {
                total: requestData.length,
                open: openRequests.length,
                pending_approval: pendingApproval.length
            };
        }
        // Get problem metrics
        if (includeAll || metric_types.includes('problems')) {
            const problems = await client.get('/api/now/table/problem', {
                params: {
                    sysparm_query: `sys_created_on${dateFilter}`,
                    sysparm_limit: 100,
                    sysparm_fields: 'number,state,priority'
                }
            });
            const problemData = problems.data.result || [];
            const openProblems = problemData.filter((prb) => prb.state !== '4');
            metrics.problems = {
                total: problemData.length,
                open: openProblems.length
            };
        }
        return (0, error_handler_js_1.createSuccessResult)({ metrics }, { timeframe, metric_types: includeAll ? 'all' : metric_types.join(',') });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_operational_metrics.js.map