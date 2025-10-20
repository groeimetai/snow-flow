"use strict";
/**
 * snow_configure_offline_sync - Configure mobile offline sync
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_configure_offline_sync',
    description: 'Configure offline synchronization settings for mobile applications. Controls which data is available offline.',
    inputSchema: {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'Table name for offline sync'
            },
            enabled: {
                type: 'boolean',
                description: 'Enable offline sync for this table',
                default: true
            },
            sync_frequency: {
                type: 'string',
                description: 'Sync frequency: manual, hourly, daily, on_launch'
            },
            query: {
                type: 'string',
                description: 'Query filter for synced records'
            },
            max_records: {
                type: 'number',
                description: 'Maximum records to sync',
                default: 100
            },
            fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific fields to sync (all if not specified)'
            }
        },
        required: ['table']
    }
};
async function execute(args, context) {
    const { table, enabled = true, sync_frequency, query, max_records = 100, fields } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const syncConfig = {
            table,
            enabled,
            max_records
        };
        if (sync_frequency)
            syncConfig.sync_frequency = sync_frequency;
        if (query)
            syncConfig.query = query;
        if (fields && fields.length > 0)
            syncConfig.fields = fields.join(',');
        const response = await client.post('/api/now/table/sys_mobile_offline_config', syncConfig);
        return (0, error_handler_js_1.createSuccessResult)({
            configured: true,
            config: response.data.result,
            table,
            enabled,
            max_records,
            message: `✅ Offline sync configured for table: ${table}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_configure_offline_sync.js.map