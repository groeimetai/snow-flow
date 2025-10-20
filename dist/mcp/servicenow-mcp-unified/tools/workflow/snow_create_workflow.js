"use strict";
/**
 * snow_create_workflow
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_workflow',
    description: 'Create workflow definition',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Workflow name' },
            table: { type: 'string', description: 'Table workflow applies to' },
            description: { type: 'string', description: 'Workflow description' },
            condition: { type: 'string', description: 'When to trigger workflow' }
        },
        required: ['name', 'table']
    }
};
async function execute(args, context) {
    const { name, table, description, condition } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const workflowData = { name, table };
        if (description)
            workflowData.description = description;
        if (condition)
            workflowData.condition = condition;
        const response = await client.post('/api/now/table/wf_workflow', workflowData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, workflow: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_workflow.js.map