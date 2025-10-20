"use strict";
/**
 * snow_scripted_rest_api
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_scripted_rest_api',
    description: 'Call scripted REST API',
    inputSchema: {
        type: 'object',
        properties: {
            api_namespace: { type: 'string', description: 'API namespace' },
            api_path: { type: 'string', description: 'API path' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
            body: { type: 'object', description: 'Request body' }
        },
        required: ['api_namespace', 'api_path']
    }
};
async function execute(args, context) {
    const { api_namespace, api_path, method = 'GET', body } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const fullPath = `/api/${api_namespace}/${api_path}`;
        let response;
        if (method === 'GET') {
            response = await client.get(fullPath);
        }
        else if (method === 'POST') {
            response = await client.post(fullPath, body);
        }
        else if (method === 'PUT') {
            response = await client.put(fullPath, body);
        }
        else if (method === 'PATCH') {
            response = await client.patch(fullPath, body);
        }
        else if (method === 'DELETE') {
            response = await client.delete(fullPath);
        }
        return (0, error_handler_js_1.createSuccessResult)({
            success: true,
            api_namespace,
            api_path,
            data: response?.data
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_scripted_rest_api.js.map