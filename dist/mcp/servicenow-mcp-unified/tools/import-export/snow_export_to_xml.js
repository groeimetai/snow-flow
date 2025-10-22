"use strict";
/**
 * snow_export_to_xml
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_export_to_xml',
    description: 'Export records to XML format',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'import-export',
    use_cases: ['export', 'xml', 'backup'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table to export' },
            query: { type: 'string', description: 'Query filter' },
            view: { type: 'string', description: 'View to use' }
        },
        required: ['table']
    }
};
async function execute(args, context) {
    const { table, query, view } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const params = { sysparm_query: query || '' };
        if (view)
            params.sysparm_view = view;
        const response = await client.get(`/api/now/table/${table}`, {
            params,
            headers: { 'Accept': 'application/xml' }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            xml: response.data,
            table,
            format: 'xml'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_export_to_xml.js.map