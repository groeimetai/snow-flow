"use strict";
/**
 * snow_create_workflow_activity - Create workflow activity
 *
 * Creates workflow activities within existing workflows. Configures
 * activity types, conditions, and execution order.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_workflow_activity',
    description: 'Creates workflow activities within existing workflows. Configures activity types, conditions, and execution order.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'workflow',
    use_cases: ['automation', 'workflow', 'activities'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Activity name' },
            workflowName: { type: 'string', description: 'Parent workflow name or sys_id' },
            activityType: { type: 'string', description: 'Activity type (approval, script, notification, etc.)' },
            script: { type: 'string', description: 'Activity script (ES5 only!)' },
            condition: { type: 'string', description: 'Activity condition' },
            order: { type: 'number', description: 'Activity order', default: 100 },
            description: { type: 'string', description: 'Activity description' }
        },
        required: ['name', 'workflowName', 'activityType']
    }
};
async function execute(args, context) {
    const { name, workflowName, activityType, script = '', condition = '', order = 100, description = '' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Resolve workflow ID if name provided
        let resolvedWorkflowId = workflowName;
        if (!workflowName.match(/^[a-f0-9]{32}$/)) {
            const workflowQuery = await client.get(`/api/now/table/wf_workflow?sysparm_query=name=${workflowName}&sysparm_limit=1`);
            if (!workflowQuery.data.result || workflowQuery.data.result.length === 0) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.SERVICENOW_API_ERROR, `Workflow not found: ${workflowName}`);
            }
            resolvedWorkflowId = workflowQuery.data.result[0].sys_id;
        }
        const activityData = {
            name,
            workflow_version: resolvedWorkflowId,
            activity_definition: activityType,
            order,
            description
        };
        if (script) {
            activityData.script = script;
        }
        if (condition) {
            activityData.condition = condition;
        }
        const response = await client.post('/api/now/table/wf_activity', activityData);
        const activity = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            workflow_activity: {
                sys_id: activity.sys_id,
                name: activity.name,
                workflow_id: resolvedWorkflowId,
                activity_type: activityType,
                order
            },
            message: '✅ Workflow activity created successfully'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }));
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_workflow_activity.js.map