"use strict";
/**
 * snow_update_change_state - Update change state
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_change_state',
    description: 'Update change request state through its lifecycle',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'change',
    use_cases: ['state-management', 'workflow', 'change-lifecycle'],
    complexity: 'intermediate',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Change request sys_id or number' },
            state: { type: 'string', description: 'New state', enum: ['draft', 'assess', 'authorize', 'scheduled', 'implement', 'review', 'closed', 'cancelled'] },
            close_notes: { type: 'string', description: 'Closure notes' },
            close_code: { type: 'string', description: 'Closure code' }
        },
        required: ['sys_id', 'state']
    }
};
async function execute(args, context) {
    const { sys_id, state, close_notes, close_code } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Map state names to numeric values
        const stateMap = {
            draft: '-5',
            assess: '-4',
            authorize: '-3',
            scheduled: '-2',
            implement: '-1',
            review: '0',
            closed: '3',
            cancelled: '4'
        };
        const updateData = { state: stateMap[state] || state };
        if (close_notes)
            updateData.close_notes = close_notes;
        if (close_code)
            updateData.close_code = close_code;
        // Find change by sys_id or number
        const changeQuery = sys_id.match(/^[a-f0-9]{32}$/)
            ? `sys_id=${sys_id}`
            : `number=${sys_id}`;
        const changeResponse = await client.get(`/api/now/table/change_request?sysparm_query=${changeQuery}`);
        if (!changeResponse.data?.result?.[0]) {
            return (0, error_handler_js_1.createErrorResult)('Change request not found');
        }
        const changeSysId = changeResponse.data.result[0].sys_id;
        const response = await client.patch(`/api/now/table/change_request/${changeSysId}`, updateData);
        return (0, error_handler_js_1.createSuccessResult)({ updated: true, change: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_update_change_state.js.map