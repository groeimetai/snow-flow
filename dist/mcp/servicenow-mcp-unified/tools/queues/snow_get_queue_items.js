"use strict";
/**
 * snow_get_queue_items
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_queue_items',
    description: 'Get items in queue',
    inputSchema: {
        type: 'object',
        properties: {
            queue_sys_id: { type: 'string', description: 'Queue sys_id' },
            limit: { type: 'number', default: 50 }
        },
        required: ['queue_sys_id']
    }
};
async function execute(args, context) {
    const { queue_sys_id, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const queueRecord = await client.get(`/api/now/table/sys_queue/${queue_sys_id}`);
        const table = queueRecord.data.result.table;
        const condition = queueRecord.data.result.condition;
        const response = await client.get(`/api/now/table/${table}`, {
            params: {
                sysparm_query: condition,
                sysparm_limit: limit
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            items: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_queue_items.js.map