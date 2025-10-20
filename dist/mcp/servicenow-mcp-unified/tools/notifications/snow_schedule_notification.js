"use strict";
/**
 * snow_schedule_notification - Schedule notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_schedule_notification',
    description: 'Schedule future notification delivery with advanced scheduling options',
    inputSchema: {
        type: 'object',
        properties: {
            recipients: {
                type: 'array',
                items: { type: 'string' },
                description: 'Recipient user sys_ids'
            },
            template: {
                type: 'string',
                description: 'Template sys_id or name'
            },
            schedule_type: {
                type: 'string',
                description: 'Schedule type',
                enum: ['once', 'recurring', 'conditional']
            },
            schedule_time: {
                type: 'string',
                description: 'ISO timestamp for one-time or start of recurring'
            },
            recurrence_pattern: {
                type: 'string',
                description: 'Cron expression for recurring notifications (e.g., "0 9 * * 1-5" for weekdays at 9am)'
            },
            subject: {
                type: 'string',
                description: 'Notification subject'
            },
            message: {
                type: 'string',
                description: 'Notification message'
            },
            personalization: {
                type: 'object',
                description: 'Template personalization data'
            }
        },
        required: ['recipients', 'schedule_type', 'schedule_time']
    }
};
async function execute(args, context) {
    const { recipients, template, schedule_type, schedule_time, recurrence_pattern, subject = 'Scheduled Notification', message = '', personalization = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        if (schedule_type === 'once') {
            // Create scheduled job for one-time notification
            const jobResponse = await client.post('/api/now/table/sysauto_script', {
                name: `Scheduled Notification - ${new Date().toISOString()}`,
                script: `
          var users = '${recipients.join(',')}';
          var userList = users.split(',');
          userList.forEach(function(userId) {
            gs.eventQueue('notification.scheduled', null, userId, '${subject}', '${message}');
          });
        `,
                run: schedule_time,
                run_type: 'once',
                active: true
            });
            return (0, error_handler_js_1.createSuccessResult)({
                scheduled: true,
                schedule_type: 'once',
                job_sys_id: jobResponse.data.result.sys_id,
                schedule_time,
                recipients_count: recipients.length
            });
        }
        if (schedule_type === 'recurring') {
            // Create recurring scheduled job
            if (!recurrence_pattern) {
                return (0, error_handler_js_1.createErrorResult)('recurrence_pattern is required for recurring notifications');
            }
            const jobResponse = await client.post('/api/now/table/sysauto_script', {
                name: `Recurring Notification - ${new Date().toISOString()}`,
                script: `
          var users = '${recipients.join(',')}';
          var userList = users.split(',');
          userList.forEach(function(userId) {
            gs.eventQueue('notification.scheduled', null, userId, '${subject}', '${message}');
          });
        `,
                run: schedule_time,
                run_type: 'periodically',
                repeat: recurrence_pattern,
                active: true
            });
            return (0, error_handler_js_1.createSuccessResult)({
                scheduled: true,
                schedule_type: 'recurring',
                job_sys_id: jobResponse.data.result.sys_id,
                schedule_time,
                recurrence_pattern,
                recipients_count: recipients.length
            });
        }
        return (0, error_handler_js_1.createErrorResult)(`Unsupported schedule_type: ${schedule_type}`);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_schedule_notification.js.map