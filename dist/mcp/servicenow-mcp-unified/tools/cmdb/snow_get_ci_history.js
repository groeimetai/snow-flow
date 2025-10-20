"use strict";
/**
 * snow_get_ci_history - CI change history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_ci_history',
    description: 'Get Configuration Item change history',
    inputSchema: {
        type: 'object',
        properties: {
            ci_sys_id: { type: 'string' },
            days_back: { type: 'number', default: 30 }
        },
        required: ['ci_sys_id']
    }
};
async function execute(args, context) {
    const { ci_sys_id, days_back = 30 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/sys_audit', {
            params: {
                sysparm_query: `documentkey=${ci_sys_id}^sys_created_on>=javascript:gs.daysAgo(${days_back})`,
                sysparm_limit: 1000
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({ history: response.data.result, days_back });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_ci_history.js.map