"use strict";
/**
 * snow_create_data_visualization - Create data visualizations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_data_visualization',
    description: 'Creates charts and visualizations using LIVE ServiceNow data',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Visualization name' },
            type: { type: 'string', description: 'Chart type (bar, line, pie, scatter, etc.)' },
            dataSource: { type: 'string', description: 'Data source (table or report)' },
            xAxis: { type: 'string', description: 'X-axis field' },
            yAxis: { type: 'string', description: 'Y-axis field' },
            series: { type: 'array', description: 'Data series configuration' },
            filters: { type: 'array', description: 'Chart filters' },
            colors: { type: 'array', description: 'Color palette' },
            interactive: { type: 'boolean', description: 'Interactive chart' }
        },
        required: ['name', 'type', 'dataSource']
    }
};
async function execute(args, context) {
    const { name, type, dataSource, xAxis, yAxis, series, filters, colors, interactive } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const vizData = {
            name,
            title: name,
            type,
            table: dataSource,
            chart_type: type,
            is_real_time: interactive !== false,
            active: true
        };
        if (xAxis)
            vizData.x_axis_field = xAxis;
        if (yAxis)
            vizData.y_axis_field = yAxis;
        if (series)
            vizData.series_config = JSON.stringify(series);
        if (filters)
            vizData.filter = JSON.stringify(filters);
        if (colors)
            vizData.color_palette = JSON.stringify(colors);
        const response = await client.post('/api/now/table/sys_report_chart', vizData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            visualization: response.data.result,
            message: `Data visualization ${name} created successfully`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_data_visualization.js.map