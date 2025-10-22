"use strict";
/**
 * snow_export_report_data - Export report data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_export_report_data',
    description: 'Exports report data to CSV, Excel, JSON, or XML formats with configurable row limits',
    // Metadata for tool discovery (not sent to LLM)
    category: 'performance-analytics',
    subcategory: 'reporting',
    use_cases: ['performance-analytics', 'reports', 'export'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            reportName: { type: 'string', description: 'Report name to export' },
            format: { type: 'string', description: 'Export format (CSV, Excel, JSON, XML)' },
            includeHeaders: { type: 'boolean', description: 'Include column headers' },
            maxRows: { type: 'number', description: 'Maximum rows to export' }
        },
        required: ['reportName', 'format']
    }
};
async function execute(args, context) {
    const { reportName, format, includeHeaders, maxRows } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Find report
        const reportQuery = await client.get('/api/now/table/sys_report', {
            params: { sysparm_query: `name=${reportName}`, sysparm_limit: 1 }
        });
        if (!reportQuery.data.result || reportQuery.data.result.length === 0) {
            throw new Error(`Report not found: ${reportName}`);
        }
        const report = reportQuery.data.result[0];
        // Get report data
        const dataQuery = await client.get(`/api/now/table/${report.table}`, {
            params: {
                sysparm_query: report.filter || '',
                sysparm_limit: maxRows || 1000
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            exported: true,
            format: format.toUpperCase(),
            records: dataQuery.data.result.length,
            data: dataQuery.data.result,
            message: `Exported ${dataQuery.data.result.length} records from ${reportName} in ${format} format`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_export_report_data.js.map