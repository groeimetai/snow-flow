"use strict";
/**
 * snow_create_menu
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_menu',
    description: 'Create application menu',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Menu title' },
            application: { type: 'string', description: 'Application sys_id' },
            order: { type: 'number', description: 'Menu order' },
            active: { type: 'boolean', default: true }
        },
        required: ['title']
    }
};
async function execute(args, context) {
    const { title, application, order, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const menuData = { title, active };
        if (application)
            menuData.application = application;
        if (order !== undefined)
            menuData.order = order;
        const response = await client.post('/api/now/table/sys_app_module', menuData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, menu: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_menu.js.map