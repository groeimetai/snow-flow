"use strict";
/**
 * snow_add_schedule_entry
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_add_schedule_entry',
    description: 'Add entry to schedule',
    inputSchema: {
        type: 'object',
        properties: {
            schedule_sys_id: { type: 'string', description: 'Schedule sys_id' },
            name: { type: 'string', description: 'Entry name' },
            type: { type: 'string', enum: ['include', 'exclude'], default: 'include' },
            start_date_time: { type: 'string', description: 'Start date time' },
            end_date_time: { type: 'string', description: 'End date time' }
        },
        required: ['schedule_sys_id', 'name']
    }
};
async function execute(args, context) {
    const { schedule_sys_id, name, type = 'include', start_date_time, end_date_time } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const entryData = {
            schedule: schedule_sys_id,
            name,
            type
        };
        if (start_date_time)
            entryData.start_date_time = start_date_time;
        if (end_date_time)
            entryData.end_date_time = end_date_time;
        const response = await client.post('/api/now/table/cmn_schedule_span', entryData);
        return (0, error_handler_js_1.createSuccessResult)({ added: true, entry: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_add_schedule_entry.js.map