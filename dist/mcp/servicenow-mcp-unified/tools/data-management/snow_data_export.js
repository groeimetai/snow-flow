"use strict";
/**
 * snow_data_export
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_data_export',
    description: 'Export table data to CSV/XML/JSON',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            query: { type: 'string', description: 'Query filter' },
            fields: { type: 'array', items: { type: 'string' }, description: 'Fields to export' },
            format: { type: 'string', enum: ['csv', 'xml', 'json'], default: 'json' },
            limit: { type: 'number', default: 1000 }
        },
        required: ['table']
    }
};
async function execute(args, context) {
    const { table, query, fields, format = 'json', limit = 1000 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const params = { sysparm_limit: limit };
        if (query)
            params.sysparm_query = query;
        if (fields)
            params.sysparm_fields = fields.join(',');
        const response = await client.get(`/api/now/table/${table}`, { params });
        return (0, error_handler_js_1.createSuccessResult)({
            data: response.data.result,
            format,
            count: response.data.result.length,
            table
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_data_export.js.map