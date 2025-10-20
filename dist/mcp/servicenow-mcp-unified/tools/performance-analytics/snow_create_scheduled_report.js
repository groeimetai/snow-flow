"use strict";
/**
 * snow_create_scheduled_report - Create scheduled reports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_scheduled_report',
    description: 'Creates scheduled reports with automated email delivery in multiple formats',
    inputSchema: {
        type: 'object',
        properties: {
            reportName: { type: 'string', description: 'Source report name' },
            schedule: { type: 'string', description: 'Schedule frequency' },
            recipients: { type: 'array', description: 'Email recipients' },
            format: { type: 'string', description: 'Report format (PDF, Excel, CSV)' },
            conditions: { type: 'string', description: 'Additional conditions' },
            subject: { type: 'string', description: 'Email subject' },
            message: { type: 'string', description: 'Email message' }
        },
        required: ['reportName', 'schedule', 'recipients']
    }
};
async function execute(args, context) {
    const { reportName, schedule, recipients, format, conditions, subject, message } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Find source report
        const reportQuery = await client.get('/api/now/table/sys_report', {
            params: { sysparm_query: `name=${reportName}`, sysparm_limit: 1 }
        });
        if (!reportQuery.data.result || reportQuery.data.result.length === 0) {
            throw new Error(`Report not found: ${reportName}`);
        }
        const reportId = reportQuery.data.result[0].sys_id;
        const scheduledData = {
            name: `Scheduled: ${reportName}`,
            report: reportId,
            run_time: schedule,
            email_to: recipients.join(','),
            format: (format || 'pdf').toLowerCase(),
            subject: subject || `Scheduled Report: ${reportName}`,
            body: message || 'Please find the attached report.',
            active: true
        };
        if (conditions)
            scheduledData.condition = conditions;
        const response = await client.post('/api/now/table/sysauto_report', scheduledData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            scheduled_report: response.data.result,
            message: `Scheduled report created for ${reportName}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_scheduled_report.js.map