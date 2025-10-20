"use strict";
/**
 * snow_approve_procurement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_approve_procurement',
    description: 'Approve procurement request',
    inputSchema: {
        type: 'object',
        properties: {
            request_sys_id: { type: 'string' },
            comments: { type: 'string' }
        },
        required: ['request_sys_id']
    }
};
async function execute(args, context) {
    const { request_sys_id, comments } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const approvalData = { approval: 'approved' };
        if (comments)
            approvalData.comments = comments;
        const response = await client.put(`/api/now/table/proc_request/${request_sys_id}`, approvalData);
        return (0, error_handler_js_1.createSuccessResult)({ approved: true, request: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_approve_procurement.js.map