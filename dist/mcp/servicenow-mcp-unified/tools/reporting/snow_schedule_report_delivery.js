"use strict";
/**
 * snow_schedule_report_delivery - Schedule report delivery via email
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_schedule_report_delivery',
    description: 'Schedule automated report delivery via email',
    inputSchema: {
        type: 'object',
        properties: {
            report_name: { type: 'string', description: 'Source report name or sys_id' },
            schedule: {
                type: 'string',
                description: 'Schedule frequency',
                enum: ['daily', 'weekly', 'monthly', 'quarterly']
            },
            recipients: { type: 'array', description: 'Email recipients', items: { type: 'string' } },
            format: {
                type: 'string',
                description: 'Report format',
                enum: ['PDF', 'Excel', 'CSV']
            },
            conditions: { type: 'string', description: 'Additional conditions' },
            subject: { type: 'string', description: 'Email subject' },
            message: { type: 'string', description: 'Email message' }
        },
        required: ['report_name', 'schedule', 'recipients']
    }
};
async function execute(args, context) {
    const { report_name, schedule, recipients, format = 'PDF', conditions, subject, message } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Find the source report
        const reportResponse = await client.get(`/api/now/table/sys_report?sysparm_query=name=${report_name}^ORsys_id=${report_name}&sysparm_limit=1`);
        if (!reportResponse.data.result || reportResponse.data.result.length === 0) {
            return (0, error_handler_js_1.createErrorResult)(`Report not found: ${report_name}`);
        }
        const sourceReport = reportResponse.data.result[0];
        // Create scheduled report
        const scheduledReportData = {
            name: `Scheduled: ${sourceReport.name || sourceReport.title}`,
            report: sourceReport.sys_id,
            schedule_type: schedule,
            email_list: recipients.join(';'),
            export_format: format.toLowerCase(),
            condition: conditions || '',
            subject: subject || `Scheduled Report: ${sourceReport.name || sourceReport.title}`,
            body: message || 'Please find the attached scheduled report.',
            active: true
        };
        const response = await client.post('/api/now/table/sysauto_report', scheduledReportData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            scheduled_report: response.data.result,
            source_report: sourceReport.name || sourceReport.title,
            schedule,
            recipients: recipients.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_schedule_report_delivery.js.map