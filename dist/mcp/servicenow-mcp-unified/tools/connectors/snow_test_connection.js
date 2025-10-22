"use strict";
/**
 * snow_test_connection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_test_connection',
    description: 'Test ServiceNow connection',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'connectors',
    use_cases: ['connection-test', 'authentication', 'diagnostics'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {}
    }
};
async function execute(args, context) {
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/sys_user', {
            params: { sysparm_limit: 1 }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            connected: true,
            instance: context.instanceUrl,
            user_count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_test_connection.js.map