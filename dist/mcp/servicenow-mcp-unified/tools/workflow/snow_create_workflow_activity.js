"use strict";
/**
 * snow_create_workflow_activity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_workflow_activity',
    description: 'Create workflow activity/stage',
    inputSchema: {
        type: 'object',
        properties: {
            workflow: { type: 'string', description: 'Workflow sys_id' },
            name: { type: 'string', description: 'Activity name' },
            activity_definition: { type: 'string', description: 'Activity type sys_id' },
            order: { type: 'number', description: 'Execution order' }
        },
        required: ['workflow', 'name', 'activity_definition']
    }
};
async function execute(args, context) {
    const { workflow, name, activity_definition, order } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const activityData = { workflow, name, activity_definition };
        if (order !== undefined)
            activityData.order = order;
        const response = await client.post('/api/now/table/wf_activity', activityData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, activity: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_workflow_activity.js.map