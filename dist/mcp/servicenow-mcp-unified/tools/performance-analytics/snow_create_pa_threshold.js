"use strict";
/**
 * snow_create_pa_threshold - Create PA thresholds
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_pa_threshold',
    description: 'Creates threshold rules for Performance Analytics indicators to trigger alerts',
    // Metadata for tool discovery (not sent to LLM)
    category: 'performance-analytics',
    subcategory: 'indicators',
    use_cases: ['performance-analytics', 'thresholds', 'alerts'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            indicator: { type: 'string', description: 'Indicator sys_id' },
            type: { type: 'string', description: 'Threshold type: warning, critical' },
            operator: { type: 'string', description: 'Operator: >, <, >=, <=, =' },
            value: { type: 'number', description: 'Threshold value' },
            duration: { type: 'number', description: 'Duration in periods before alert' },
            notification_group: { type: 'string', description: 'Group to notify' }
        },
        required: ['indicator', 'type', 'operator', 'value']
    }
};
async function execute(args, context) {
    const { indicator, type, operator, value, duration, notification_group } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const thresholdData = {
            indicator,
            type,
            operator,
            value,
            duration: duration || 1
        };
        if (notification_group)
            thresholdData.notification_group = notification_group;
        const response = await client.post('/api/now/table/pa_thresholds', thresholdData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            threshold: response.data.result,
            message: `PA threshold created for indicator ${indicator}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_pa_threshold.js.map