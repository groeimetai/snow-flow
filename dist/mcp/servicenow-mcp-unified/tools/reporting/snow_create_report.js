"use strict";
/**
 * snow_create_report - Create report
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_report',
    description: 'Create ServiceNow report',
    // Metadata for tool discovery (not sent to LLM)
    category: 'reporting',
    subcategory: 'reports',
    use_cases: ['reporting', 'visualization', 'analytics'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string' },
            table: { type: 'string' },
            type: { type: 'string', enum: ['bar', 'pie', 'line', 'list'] },
            filter: { type: 'string' }
        },
        required: ['title', 'table', 'type']
    }
};
async function execute(args, context) {
    const { title, table, type, filter } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const reportData = { title, table, type };
        if (filter)
            reportData.filter = filter;
        const response = await client.post('/api/now/table/sys_report', reportData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, report: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_report.js.map