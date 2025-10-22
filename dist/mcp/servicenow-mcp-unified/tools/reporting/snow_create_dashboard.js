"use strict";
/**
 * snow_create_dashboard - Create dashboards
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_dashboard',
    description: 'Create interactive dashboards with multiple widgets',
    // Metadata for tool discovery (not sent to LLM)
    category: 'reporting',
    subcategory: 'dashboards',
    use_cases: ['dashboards', 'visualization', 'analytics'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Dashboard name' },
            description: { type: 'string', description: 'Dashboard description' },
            layout: { type: 'string', description: 'Dashboard layout (grid, tabs, accordion)', enum: ['grid', 'tabs', 'accordion'] },
            widgets: { type: 'array', description: 'Dashboard widgets configuration' },
            permissions: { type: 'array', description: 'User/role permissions', items: { type: 'string' } },
            refresh_interval: { type: 'number', description: 'Auto-refresh interval in minutes' },
            public: { type: 'boolean', description: 'Public dashboard' }
        },
        required: ['name', 'widgets']
    }
};
async function execute(args, context) {
    const { name, description, layout = 'grid', widgets = [], permissions = [], refresh_interval = 15, public: isPublic = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create dashboard using pa_dashboards table
        const dashboardData = {
            name,
            title: name,
            description: description || '',
            layout,
            refresh_interval,
            active: true,
            roles: permissions.join(','),
            public: isPublic
        };
        const response = await client.post('/api/now/table/pa_dashboards', dashboardData);
        if (!response.data.result) {
            return (0, error_handler_js_1.createErrorResult)('Failed to create dashboard');
        }
        const dashboardId = response.data.result.sys_id;
        // Add widgets to dashboard if provided
        if (widgets.length > 0) {
            for (const widget of widgets) {
                await client.post('/api/now/table/pa_widgets', {
                    dashboard: dashboardId,
                    title: widget.name || widget.title,
                    type: widget.type || 'chart',
                    order: widget.order || 0,
                    ...widget
                });
            }
        }
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            dashboard: response.data.result,
            widgets_added: widgets.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_dashboard.js.map