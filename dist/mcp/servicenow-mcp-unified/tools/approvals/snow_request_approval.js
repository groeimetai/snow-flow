"use strict";
/**
 * snow_request_approval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_request_approval',
    description: 'Request approval for record',
    inputSchema: {
        type: 'object',
        properties: {
            source_table: { type: 'string', description: 'Source table name' },
            source_sys_id: { type: 'string', description: 'Source record sys_id' },
            approver: { type: 'string', description: 'Approver user sys_id' },
            comments: { type: 'string', description: 'Approval comments' }
        },
        required: ['source_table', 'source_sys_id', 'approver']
    }
};
async function execute(args, context) {
    const { source_table, source_sys_id, approver, comments } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const approvalData = {
            source_table,
            sysapproval: source_sys_id,
            approver,
            state: 'requested'
        };
        if (comments)
            approvalData.comments = comments;
        const response = await client.post('/api/now/table/sysapproval_approver', approvalData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, approval: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_request_approval.js.map