"use strict";
/**
 * snow_configure_mobile_app - Configure mobile app
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_configure_mobile_app',
    description: 'Configure ServiceNow mobile app',
    inputSchema: {
        type: 'object',
        properties: {
            app_name: { type: 'string' },
            platform: { type: 'string', enum: ['ios', 'android'] },
            features: { type: 'array', items: { type: 'string' } }
        },
        required: ['app_name', 'platform']
    }
};
async function execute(args, context) {
    const { app_name, platform, features = [] } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const appData = { name: app_name, platform, features: features.join(',') };
        const response = await client.post('/api/now/table/sys_mobile_app', appData);
        return (0, error_handler_js_1.createSuccessResult)({ configured: true, mobile_app: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_configure_mobile_app.js.map