"use strict";
/**
 * snow_create_pa_indicator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_pa_indicator',
    description: 'Create PA indicator',
    // Metadata for tool discovery (not sent to LLM)
    category: 'performance-analytics',
    subcategory: 'indicators',
    use_cases: ['performance-analytics', 'indicators', 'metrics'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            table: { type: 'string' },
            field: { type: 'string' },
            aggregate: { type: 'string', enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] }
        },
        required: ['name', 'table', 'field', 'aggregate']
    }
};
async function execute(args, context) {
    const { name, table, field, aggregate } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const indicatorData = { name, table, field, aggregate };
        const response = await client.post('/api/now/table/pa_indicators', indicatorData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, indicator: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_pa_indicator.js.map