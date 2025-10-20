"use strict";
/**
 * snow_get_change_request - Get change request details
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_change_request',
    description: 'Get change request details including approval status, tasks, and related items',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Change request sys_id or number' },
            include_tasks: { type: 'boolean', description: 'Include change tasks', default: true },
            include_approvals: { type: 'boolean', description: 'Include approval history', default: true }
        },
        required: ['sys_id']
    }
};
async function execute(args, context) {
    const { sys_id, include_tasks = true, include_approvals = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get change request
        const changeQuery = sys_id.match(/^[a-f0-9]{32}$/)
            ? `sys_id=${sys_id}`
            : `number=${sys_id}`;
        const changeResponse = await client.get(`/api/now/table/change_request?sysparm_query=${changeQuery}`);
        if (!changeResponse.data?.result?.[0]) {
            return (0, error_handler_js_1.createErrorResult)('Change request not found');
        }
        const change = changeResponse.data.result[0];
        const result = { change };
        // Get tasks if requested
        if (include_tasks) {
            const tasksResponse = await client.get(`/api/now/table/change_task?sysparm_query=change_request=${change.sys_id}`);
            result.tasks = tasksResponse.data?.result || [];
        }
        // Get approvals if requested
        if (include_approvals) {
            const approvalsResponse = await client.get(`/api/now/table/sysapproval_approver?sysparm_query=document_id=${change.sys_id}`);
            result.approvals = approvalsResponse.data?.result || [];
        }
        return (0, error_handler_js_1.createSuccessResult)(result);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_change_request.js.map