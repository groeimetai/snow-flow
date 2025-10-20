"use strict";
/**
 * snow_schedule_cab - Schedule CAB meeting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_schedule_cab',
    description: 'Schedule Change Advisory Board meeting',
    inputSchema: {
        type: 'object',
        properties: {
            change_request: { type: 'string' },
            meeting_date: { type: 'string' },
            attendees: { type: 'array', items: { type: 'string' } }
        },
        required: ['change_request', 'meeting_date']
    }
};
async function execute(args, context) {
    const { change_request, meeting_date, attendees = [] } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const cabData = { change_request, meeting_date, attendees: attendees.join(',') };
        const response = await client.post('/api/now/table/cab_meeting', cabData);
        return (0, error_handler_js_1.createSuccessResult)({ scheduled: true, meeting: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_schedule_cab.js.map