"use strict";
/**
 * snow_list_plugins
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_list_plugins',
    description: 'List installed plugins',
    inputSchema: {
        type: 'object',
        properties: {
            active_only: { type: 'boolean', default: false }
        }
    }
};
async function execute(args, context) {
    const { active_only = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const query = active_only ? 'active=true' : '';
        const response = await client.get('/api/now/table/v_plugin', {
            params: {
                sysparm_query: query,
                sysparm_limit: 100
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            plugins: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_list_plugins.js.map