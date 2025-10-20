"use strict";
/**
 * snow_aggregate_metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_aggregate_metrics',
    description: 'Aggregate table metrics',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            field: { type: 'string', description: 'Field to aggregate' },
            aggregation: { type: 'string', enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'], default: 'COUNT' },
            group_by: { type: 'string', description: 'Field to group by' }
        },
        required: ['table']
    }
};
async function execute(args, context) {
    const { table, field, aggregation = 'COUNT', group_by } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const params = {
            sysparm_query: '',
            sysparm_count: aggregation === 'COUNT'
        };
        if (group_by)
            params.sysparm_group_by = group_by;
        const response = await client.get(`/api/now/stats/${table}`, { params });
        return (0, error_handler_js_1.createSuccessResult)({
            aggregated: true,
            table,
            aggregation,
            result: response.data.result
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_aggregate_metrics.js.map