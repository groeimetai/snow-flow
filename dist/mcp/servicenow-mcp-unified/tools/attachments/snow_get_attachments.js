"use strict";
/**
 * snow_get_attachments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_attachments',
    description: 'Get attachments for record',
    inputSchema: {
        type: 'object',
        properties: {
            table_name: { type: 'string', description: 'Table name' },
            table_sys_id: { type: 'string', description: 'Record sys_id' }
        },
        required: ['table_name', 'table_sys_id']
    }
};
async function execute(args, context) {
    const { table_name, table_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/attachment', {
            params: {
                sysparm_query: `table_name=${table_name}^table_sys_id=${table_sys_id}`
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            attachments: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_attachments.js.map