"use strict";
/**
 * snow_duplicate_detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_duplicate_detection',
    description: 'Detect duplicate records',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            match_fields: { type: 'array', items: { type: 'string' }, description: 'Fields to match' },
            record_data: { type: 'object', description: 'Record data to check' }
        },
        required: ['table', 'match_fields', 'record_data']
    }
};
async function execute(args, context) {
    const { table, match_fields, record_data } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const query = match_fields.map(field => `${field}=${record_data[field]}`).join('^');
        const response = await client.get(`/api/now/table/${table}`, {
            params: {
                sysparm_query: query,
                sysparm_limit: 10
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            has_duplicates: response.data.result.length > 0,
            duplicates: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_duplicate_detection.js.map