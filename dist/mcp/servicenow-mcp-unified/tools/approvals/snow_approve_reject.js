"use strict";
/**
 * snow_approve_reject
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_approve_reject',
    description: 'Approve or reject approval request',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'approvals',
    use_cases: ['approvals', 'workflow', 'decision'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            approval_sys_id: { type: 'string', description: 'Approval sys_id' },
            action: { type: 'string', enum: ['approved', 'rejected'], description: 'Action' },
            comments: { type: 'string', description: 'Comments' }
        },
        required: ['approval_sys_id', 'action']
    }
};
async function execute(args, context) {
    const { approval_sys_id, action, comments } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const updateData = { state: action };
        if (comments)
            updateData.comments = comments;
        const response = await client.patch(`/api/now/table/sysapproval_approver/${approval_sys_id}`, updateData);
        return (0, error_handler_js_1.createSuccessResult)({ updated: true, action, approval: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_approve_reject.js.map