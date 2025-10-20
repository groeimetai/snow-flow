"use strict";
/**
 * snow_create_hr_task - Create HR task
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_hr_task',
    description: 'Create HR task for case fulfillment',
    inputSchema: {
        type: 'object',
        properties: {
            hr_case: { type: 'string', description: 'Parent HR case sys_id' },
            type: { type: 'string', description: 'Task type' },
            assigned_to: { type: 'string', description: 'Assigned user sys_id' },
            short_description: { type: 'string', description: 'Task description' },
            due_date: { type: 'string', description: 'Due date' },
            instructions: { type: 'string', description: 'Task instructions' }
        },
        required: ['hr_case', 'type', 'short_description']
    }
};
async function execute(args, context) {
    const { hr_case, type, assigned_to, short_description, due_date, instructions } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const taskData = { hr_case, type, short_description };
        if (assigned_to)
            taskData.assigned_to = assigned_to;
        if (due_date)
            taskData.due_date = due_date;
        if (instructions)
            taskData.instructions = instructions;
        const response = await client.post('/api/now/table/sn_hr_core_task', taskData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, task: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_hr_task.js.map