"use strict";
/**
 * snow_create_dashboard
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_dashboard',
    description: 'Create dashboard',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Dashboard title' },
            description: { type: 'string', description: 'Dashboard description' },
            columns: { type: 'number', default: 2, description: 'Number of columns' },
            active: { type: 'boolean', default: true }
        },
        required: ['title']
    }
};
async function execute(args, context) {
    const { title, description, columns = 2, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const dashboardData = { title, columns, active };
        if (description)
            dashboardData.description = description;
        const response = await client.post('/api/now/table/sys_dashboard', dashboardData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, dashboard: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_dashboard.js.map