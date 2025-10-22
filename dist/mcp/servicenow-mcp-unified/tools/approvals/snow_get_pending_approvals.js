"use strict";
/**
 * snow_get_pending_approvals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_pending_approvals',
    description: 'Get pending approvals for user',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'approvals',
    use_cases: ['approvals', 'query', 'pending'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            approver_sys_id: { type: 'string', description: 'Approver user sys_id' },
            limit: { type: 'number', default: 100 }
        },
        required: ['approver_sys_id']
    }
};
async function execute(args, context) {
    const { approver_sys_id, limit = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/sysapproval_approver', {
            params: {
                sysparm_query: `approver=${approver_sys_id}^state=requested`,
                sysparm_limit: limit,
                sysparm_display_value: 'true'
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            approvals: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_pending_approvals.js.map