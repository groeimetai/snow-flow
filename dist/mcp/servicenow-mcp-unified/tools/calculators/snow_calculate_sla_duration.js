"use strict";
/**
 * snow_calculate_sla_duration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_calculate_sla_duration',
    description: 'Calculate SLA duration with schedule',
    inputSchema: {
        type: 'object',
        properties: {
            start_time: { type: 'string', description: 'Start datetime' },
            end_time: { type: 'string', description: 'End datetime' },
            schedule_sys_id: { type: 'string', description: 'Schedule sys_id' }
        },
        required: ['start_time', 'end_time']
    }
};
async function execute(args, context) {
    const { start_time, end_time, schedule_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const calcScript = `
var startGDT = new GlideDateTime('${start_time}');
var endGDT = new GlideDateTime('${end_time}');
var duration = GlideDateTime.subtract(startGDT, endGDT);
gs.info('Duration: ' + duration.getDisplayValue());
    `;
        await client.post('/api/now/table/sys_script_execution', { script: calcScript });
        return (0, error_handler_js_1.createSuccessResult)({
            calculated: true,
            start_time,
            end_time
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_calculate_sla_duration.js.map