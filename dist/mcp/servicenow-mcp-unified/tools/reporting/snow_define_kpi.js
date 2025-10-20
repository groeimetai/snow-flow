"use strict";
/**
 * snow_define_kpi - Define KPIs (Key Performance Indicators)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_define_kpi',
    description: 'Define Key Performance Indicators for monitoring',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'KPI name' },
            description: { type: 'string', description: 'KPI description' },
            table: { type: 'string', description: 'Source table' },
            metric: { type: 'string', description: 'Metric to measure' },
            aggregation: {
                type: 'string',
                description: 'Aggregation function',
                enum: ['count', 'sum', 'avg', 'max', 'min']
            },
            conditions: { type: 'string', description: 'KPI conditions/filters' },
            target: { type: 'number', description: 'Target value' },
            threshold: { type: 'object', description: 'Threshold configuration' },
            unit: { type: 'string', description: 'Unit of measurement' },
            frequency: { type: 'string', description: 'Update frequency', enum: ['hourly', 'daily', 'weekly', 'monthly'] }
        },
        required: ['name', 'table', 'metric', 'aggregation']
    }
};
async function execute(args, context) {
    const { name, description, table, metric, aggregation, conditions, target, threshold, unit, frequency = 'daily' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create KPI using pa_indicators table
        const kpiData = {
            name,
            label: name,
            description: description || '',
            facts_table: table,
            field: metric,
            aggregate: aggregation.toUpperCase(),
            conditions: conditions || '',
            unit: unit || '',
            frequency,
            active: true,
            direction: target ? 'minimize' : 'maximize'
        };
        if (target) {
            kpiData.target = target;
        }
        if (threshold) {
            kpiData.threshold_config = JSON.stringify(threshold);
        }
        const response = await client.post('/api/now/table/pa_indicators', kpiData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            kpi: response.data.result
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_define_kpi.js.map