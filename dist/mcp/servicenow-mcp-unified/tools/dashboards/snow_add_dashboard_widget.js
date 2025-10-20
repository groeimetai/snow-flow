"use strict";
/**
 * snow_add_dashboard_widget
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_add_dashboard_widget',
    description: 'Add widget to dashboard',
    inputSchema: {
        type: 'object',
        properties: {
            dashboard_sys_id: { type: 'string', description: 'Dashboard sys_id' },
            widget_type: { type: 'string', description: 'Widget type' },
            title: { type: 'string', description: 'Widget title' },
            position: { type: 'number', description: 'Widget position' }
        },
        required: ['dashboard_sys_id', 'widget_type']
    }
};
async function execute(args, context) {
    const { dashboard_sys_id, widget_type, title, position } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const widgetData = {
            dashboard: dashboard_sys_id,
            type: widget_type
        };
        if (title)
            widgetData.title = title;
        if (position !== undefined)
            widgetData.position = position;
        const response = await client.post('/api/now/table/sys_dashboard_widget', widgetData);
        return (0, error_handler_js_1.createSuccessResult)({ added: true, widget: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_add_dashboard_widget.js.map