"use strict";
/**
 * snow_create_metric
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_metric',
    description: 'Create system metric',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Metric name' },
            table: { type: 'string', description: 'Table to measure' },
            field: { type: 'string', description: 'Field to measure' },
            calculation: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'], default: 'count' }
        },
        required: ['name', 'table']
    }
};
async function execute(args, context) {
    const { name, table, field, calculation = 'count' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const metricData = { name, table, calculation };
        if (field)
            metricData.field = field;
        const response = await client.post('/api/now/table/metric_definition', metricData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, metric: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_metric.js.map