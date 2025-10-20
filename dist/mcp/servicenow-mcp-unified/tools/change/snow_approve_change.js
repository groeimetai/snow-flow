"use strict";
/**
 * snow_approve_change - Approve change request
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_approve_change',
    description: 'Approve change request',
    inputSchema: {
        type: 'object',
        properties: {
            change_sys_id: { type: 'string' },
            comments: { type: 'string' }
        },
        required: ['change_sys_id']
    }
};
async function execute(args, context) {
    const { change_sys_id, comments } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const updateData = { approval: 'approved' };
        if (comments)
            updateData.comments = comments;
        const response = await client.put(`/api/now/table/change_request/${change_sys_id}`, updateData);
        return (0, error_handler_js_1.createSuccessResult)({ approved: true, change: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_approve_change.js.map