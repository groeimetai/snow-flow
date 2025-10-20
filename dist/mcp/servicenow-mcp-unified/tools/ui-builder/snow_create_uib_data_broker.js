"use strict";
/**
 * snow_create_uib_data_broker - Create data brokers
 *
 * Creates UI Builder data brokers for connecting pages to ServiceNow
 * data sources using official sys_ux_data_broker API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_uib_data_broker',
    description: 'Create data broker to connect UI Builder pages to ServiceNow data sources',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: {
                type: 'string',
                description: 'Target page sys_id'
            },
            name: {
                type: 'string',
                description: 'Data broker name'
            },
            table: {
                type: 'string',
                description: 'ServiceNow table to query'
            },
            query: {
                type: 'string',
                description: 'Query string for data retrieval'
            },
            fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to retrieve',
                default: []
            },
            order_by: {
                type: 'string',
                description: 'Order by field'
            },
            limit: {
                type: 'number',
                description: 'Maximum records to retrieve',
                default: 100
            }
        },
        required: ['page_id', 'name', 'table']
    }
};
async function execute(args, context) {
    const { page_id, name, table, query = '', fields = [], order_by, limit = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const payload = {
            page: page_id,
            name,
            table,
            query,
            limit
        };
        if (fields.length > 0)
            payload.fields = fields.join(',');
        if (order_by)
            payload.order_by = order_by;
        const response = await client.post('/api/now/table/sys_ux_data_broker', payload);
        return (0, error_handler_js_1.createSuccessResult)({
            data_broker: {
                sys_id: response.data.result.sys_id,
                name,
                table,
                page_id
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_uib_data_broker.js.map