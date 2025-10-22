"use strict";
/**
 * snow_create_project_task
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_project_task',
    description: 'Create project task',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'project-management',
    use_cases: ['project-tasks', 'ppm', 'task-management'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            project: { type: 'string' },
            short_description: { type: 'string' },
            assigned_to: { type: 'string' },
            planned_hours: { type: 'number' }
        },
        required: ['project', 'short_description']
    }
};
async function execute(args, context) {
    const { project, short_description, assigned_to, planned_hours } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const taskData = { project, short_description };
        if (assigned_to)
            taskData.assigned_to = assigned_to;
        if (planned_hours)
            taskData.planned_hours = planned_hours;
        const response = await client.post('/api/now/table/pm_project_task', taskData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, task: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_project_task.js.map