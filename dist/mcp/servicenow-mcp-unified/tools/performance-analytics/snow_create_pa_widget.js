"use strict";
/**
 * snow_create_pa_widget - Create PA dashboard widgets
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_pa_widget',
    description: 'Creates a Performance Analytics dashboard widget for visualizing indicators',
    // Metadata for tool discovery (not sent to LLM)
    category: 'performance-analytics',
    subcategory: 'widgets',
    use_cases: ['performance-analytics', 'widgets', 'dashboards'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Widget name' },
            type: { type: 'string', description: 'Widget type: time_series, scorecard, dial, column, pie' },
            indicator: { type: 'string', description: 'Indicator sys_id to display' },
            breakdown: { type: 'string', description: 'Breakdown field for grouping' },
            time_range: { type: 'string', description: 'Time range: 7days, 30days, 90days, 1year' },
            dashboard: { type: 'string', description: 'Dashboard to add widget to' },
            size_x: { type: 'number', description: 'Widget width', default: 4 },
            size_y: { type: 'number', description: 'Widget height', default: 3 }
        },
        required: ['name', 'type', 'indicator']
    }
};
async function execute(args, context) {
    const { name, type, indicator, breakdown, time_range, dashboard, size_x, size_y } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const widgetData = {
            name,
            type,
            indicator,
            time_range: time_range || '30days',
            size_x: size_x || 4,
            size_y: size_y || 3
        };
        if (breakdown)
            widgetData.breakdown = breakdown;
        if (dashboard)
            widgetData.dashboard = dashboard;
        const response = await client.post('/api/now/table/pa_widgets', widgetData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            widget: response.data.result,
            message: `PA widget ${name} created successfully`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_pa_widget.js.map