"use strict";
/**
 * snow_execute_workflow
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_execute_workflow',
    description: 'Execute workflow on record',
    inputSchema: {
        type: 'object',
        properties: {
            workflow_sys_id: { type: 'string', description: 'Workflow sys_id' },
            record_sys_id: { type: 'string', description: 'Record to process' }
        },
        required: ['workflow_sys_id', 'record_sys_id']
    }
};
async function execute(args, context) {
    const { workflow_sys_id, record_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const executeScript = `
var workflow = new Workflow();
workflow.startFlow('${workflow_sys_id}', null, 'insert', {'sys_id': '${record_sys_id}'});
    `;
        const response = await client.post('/api/now/table/sys_script_execution', {
            script: executeScript
        });
        return (0, error_handler_js_1.createSuccessResult)({
            executed: true,
            workflow: workflow_sys_id,
            record: record_sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_execute_workflow.js.map