"use strict";
/**
 * snow_create_change_task - Create change task
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_change_task',
    description: 'Create change implementation task',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'change',
    use_cases: ['tasks', 'change-management', 'implementation'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            change_request: { type: 'string' },
            short_description: { type: 'string' },
            assigned_to: { type: 'string' },
            planned_start_date: { type: 'string' },
            planned_end_date: { type: 'string' }
        },
        required: ['change_request', 'short_description']
    }
};
async function execute(args, context) {
    const { change_request, short_description, assigned_to, planned_start_date, planned_end_date } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const taskData = { change_request, short_description };
        if (assigned_to)
            taskData.assigned_to = assigned_to;
        if (planned_start_date)
            taskData.planned_start_date = planned_start_date;
        if (planned_end_date)
            taskData.planned_end_date = planned_end_date;
        const response = await client.post('/api/now/table/change_task', taskData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, task: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_change_task.js.map