"use strict";
/**
 * snow_configure_uib_data_broker - Configure data brokers
 *
 * Updates configuration for existing data brokers including queries,
 * caching, and refresh settings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_configure_uib_data_broker',
    description: 'Update data broker configuration including queries, caching, and refresh settings',
    inputSchema: {
        type: 'object',
        properties: {
            data_broker_id: {
                type: 'string',
                description: 'Data broker sys_id to configure'
            },
            query: {
                type: 'string',
                description: 'Query string for data retrieval'
            },
            refresh_interval: {
                type: 'number',
                description: 'Refresh interval in seconds'
            },
            enable_caching: {
                type: 'boolean',
                description: 'Enable data caching'
            },
            cache_duration: {
                type: 'number',
                description: 'Cache duration in seconds'
            },
            parameters: {
                type: 'object',
                description: 'Data broker parameters'
            },
            filters: {
                type: 'array',
                items: { type: 'object' },
                description: 'Data filters'
            }
        },
        required: ['data_broker_id']
    }
};
async function execute(args, context) {
    const { data_broker_id, query, refresh_interval, enable_caching, cache_duration, parameters, filters } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build update payload
        const payload = {};
        if (query !== undefined)
            payload.query = query;
        if (refresh_interval !== undefined)
            payload.refresh_interval = refresh_interval;
        if (enable_caching !== undefined)
            payload.enable_caching = enable_caching;
        if (cache_duration !== undefined)
            payload.cache_duration = cache_duration;
        if (parameters !== undefined)
            payload.parameters = JSON.stringify(parameters);
        if (filters !== undefined)
            payload.filters = JSON.stringify(filters);
        const response = await client.patch(`/api/now/table/sys_ux_data_broker/${data_broker_id}`, payload);
        return (0, error_handler_js_1.createSuccessResult)({
            data_broker: {
                sys_id: response.data.result.sys_id,
                configured: true
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_configure_uib_data_broker.js.map