"use strict";
/**
 * snow_schedule_cab_meeting - Schedule CAB meeting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_schedule_cab_meeting',
    description: 'Schedule a Change Advisory Board (CAB) meeting for change review',
    inputSchema: {
        type: 'object',
        properties: {
            change_request: { type: 'string', description: 'Change request sys_id' },
            meeting_date: { type: 'string', description: 'Meeting date/time' },
            attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee sys_ids' },
            agenda: { type: 'string', description: 'Meeting agenda' },
            location: { type: 'string', description: 'Meeting location or link' }
        },
        required: ['change_request', 'meeting_date']
    }
};
async function execute(args, context) {
    const { change_request, meeting_date, attendees, agenda, location } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const cabData = {
            change_request,
            meeting_date,
            short_description: `CAB Meeting for ${change_request}`,
            sys_class_name: 'task'
        };
        if (attendees)
            cabData.attendees = attendees.join(',');
        if (agenda)
            cabData.agenda = agenda;
        if (location)
            cabData.location = location;
        const response = await client.post('/api/now/table/task', cabData);
        return (0, error_handler_js_1.createSuccessResult)({ scheduled: true, meeting: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_schedule_cab_meeting.js.map