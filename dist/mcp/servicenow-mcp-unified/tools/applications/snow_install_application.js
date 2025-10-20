"use strict";
/**
 * snow_install_application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_install_application',
    description: 'Install application from store',
    inputSchema: {
        type: 'object',
        properties: {
            app_id: { type: 'string', description: 'Application ID from store' },
            version: { type: 'string', description: 'Version to install' }
        },
        required: ['app_id']
    }
};
async function execute(args, context) {
    const { app_id, version } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const installData = { sys_id: app_id };
        if (version)
            installData.version = version;
        const response = await client.post('/api/now/table/sys_store_app', installData);
        return (0, error_handler_js_1.createSuccessResult)({ installed: true, application: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_install_application.js.map