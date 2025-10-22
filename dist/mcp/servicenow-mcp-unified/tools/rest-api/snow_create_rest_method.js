"use strict";
/**
 * snow_create_rest_method
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_rest_method',
    description: 'Create REST method for REST message',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'rest-api',
    use_cases: ['rest-integration', 'api', 'http-methods'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            rest_message_sys_id: { type: 'string', description: 'REST message sys_id' },
            name: { type: 'string', description: 'Method name' },
            http_method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
            endpoint: { type: 'string', description: 'Endpoint path' },
            content: { type: 'string', description: 'Request body template' }
        },
        required: ['rest_message_sys_id', 'name']
    }
};
async function execute(args, context) {
    const { rest_message_sys_id, name, http_method = 'GET', endpoint, content } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const methodData = {
            rest_message: rest_message_sys_id,
            name,
            http_method
        };
        if (endpoint)
            methodData.endpoint = endpoint;
        if (content)
            methodData.content = content;
        const response = await client.post('/api/now/table/sys_rest_message_fn', methodData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, rest_method: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_rest_method.js.map