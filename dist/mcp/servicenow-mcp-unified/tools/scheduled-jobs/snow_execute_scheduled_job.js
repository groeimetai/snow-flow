"use strict";
/**
 * snow_execute_scheduled_job
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_execute_scheduled_job',
    description: 'Execute scheduled job immediately',
    inputSchema: {
        type: 'object',
        properties: {
            job_sys_id: { type: 'string', description: 'Scheduled job sys_id' }
        },
        required: ['job_sys_id']
    }
};
async function execute(args, context) {
    const { job_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const executeScript = `
var job = new GlideRecord('sysauto_script');
if (job.get('${job_sys_id}')) {
  var worker = new GlideScriptedHierarchicalWorker();
  worker.setProgressName('Scheduled Job: ' + job.name);
  worker.setScriptIncludeName('ScheduledScriptExecution');
  worker.putMethodArg('sys_id', '${job_sys_id}');
  worker.setBackground(true);
  worker.start();
  gs.info('Job executed: ' + job.name);
}
    `;
        await client.post('/api/now/table/sys_script_execution', { script: executeScript });
        return (0, error_handler_js_1.createSuccessResult)({
            executed: true,
            job: job_sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_execute_scheduled_job.js.map