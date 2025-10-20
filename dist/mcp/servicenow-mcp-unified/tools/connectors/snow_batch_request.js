"use strict";
/**
 * snow_batch_request
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_batch_request',
    description: 'Execute batch REST requests',
    inputSchema: {
        type: 'object',
        properties: {
            requests: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                        url: { type: 'string' },
                        body: { type: 'object' }
                    }
                },
                description: 'Array of requests'
            }
        },
        required: ['requests']
    }
};
async function execute(args, context) {
    const { requests } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const batchData = {
            batch_request_id: `batch_${Date.now()}`,
            rest_requests: requests
        };
        const response = await client.post('/api/now/v1/batch', batchData);
        return (0, error_handler_js_1.createSuccessResult)({
            executed: true,
            batch_id: batchData.batch_request_id,
            results: response.data.result
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_batch_request.js.map