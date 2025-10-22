"use strict";
/**
 * snow_custom_api
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_custom_api',
    description: 'Call custom API endpoint',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'api',
    use_cases: ['custom-api', 'rest', 'integration'],
    complexity: 'advanced',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
            path: { type: 'string', description: 'API path (relative to instance URL)' },
            body: { type: 'object', description: 'Request body' },
            params: { type: 'object', description: 'Query parameters' }
        },
        required: ['path']
    }
};
async function execute(args, context) {
    const { method = 'GET', path, body, params } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const config = { params };
        let response;
        if (method === 'GET') {
            response = await client.get(path, config);
        }
        else if (method === 'POST') {
            response = await client.post(path, body, config);
        }
        else if (method === 'PUT') {
            response = await client.put(path, body, config);
        }
        else if (method === 'PATCH') {
            response = await client.patch(path, body, config);
        }
        else if (method === 'DELETE') {
            response = await client.delete(path, config);
        }
        return (0, error_handler_js_1.createSuccessResult)({
            success: true,
            method,
            path,
            status: response?.status,
            data: response?.data
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_custom_api.js.map