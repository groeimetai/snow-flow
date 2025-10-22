"use strict";
/**
 * snow_discover_data_sources - Data source discovery
 *
 * Discover available data sources for integration. Identifies import sets,
 * REST endpoints, and external databases.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_data_sources',
    description: 'Discover available data sources for integration including import sets and REST endpoints',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'discovery',
    use_cases: ['integration', 'discovery', 'data-sources'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            sourceType: {
                type: 'string',
                enum: ['all', 'import_set', 'rest', 'jdbc', 'ldap', 'file'],
                description: 'Filter by source type',
                default: 'all'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results per type',
                default: 50
            }
        }
    }
};
async function execute(args, context) {
    const { sourceType = 'all', limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const dataSources = [];
        // Discover Import Sets
        if (sourceType === 'all' || sourceType === 'import_set') {
            const importSetsResponse = await client.get('/api/now/table/sys_import_set_table_list', {
                params: { sysparm_limit: limit }
            });
            if (importSetsResponse.data.result) {
                dataSources.push({
                    type: 'Import Sets',
                    count: importSetsResponse.data.result.length,
                    sources: importSetsResponse.data.result.map((is) => ({
                        name: is.name,
                        label: is.label,
                        table: is.name,
                        sys_id: is.sys_id
                    }))
                });
            }
        }
        // Discover REST Messages
        if (sourceType === 'all' || sourceType === 'rest') {
            const restResponse = await client.get('/api/now/table/sys_rest_message', {
                params: { sysparm_limit: limit }
            });
            if (restResponse.data.result) {
                dataSources.push({
                    type: 'REST Messages',
                    count: restResponse.data.result.length,
                    sources: restResponse.data.result.map((rest) => ({
                        name: rest.name,
                        endpoint: rest.endpoint,
                        authentication: rest.authentication_type,
                        sys_id: rest.sys_id
                    }))
                });
            }
        }
        // Discover JDBC Data Sources
        if (sourceType === 'all' || sourceType === 'jdbc') {
            const jdbcResponse = await client.get('/api/now/table/sys_data_source', {
                params: {
                    sysparm_query: 'type=jdbc',
                    sysparm_limit: limit
                }
            });
            if (jdbcResponse.data.result) {
                dataSources.push({
                    type: 'JDBC Data Sources',
                    count: jdbcResponse.data.result.length,
                    sources: jdbcResponse.data.result.map((jdbc) => ({
                        name: jdbc.name,
                        database: jdbc.database_name,
                        server: jdbc.connection_url,
                        sys_id: jdbc.sys_id
                    }))
                });
            }
        }
        // Discover LDAP Servers
        if (sourceType === 'all' || sourceType === 'ldap') {
            const ldapResponse = await client.get('/api/now/table/ldap_server_config', {
                params: { sysparm_limit: limit }
            });
            if (ldapResponse.data.result) {
                dataSources.push({
                    type: 'LDAP Servers',
                    count: ldapResponse.data.result.length,
                    sources: ldapResponse.data.result.map((ldap) => ({
                        name: ldap.name,
                        server: ldap.server,
                        port: ldap.port,
                        sys_id: ldap.sys_id
                    }))
                });
            }
        }
        // Discover Transform Maps
        const transformResponse = await client.get('/api/now/table/sys_transform_map', {
            params: { sysparm_limit: limit }
        });
        if (transformResponse.data.result) {
            dataSources.push({
                type: 'Transform Maps',
                count: transformResponse.data.result.length,
                sources: transformResponse.data.result.map((tm) => ({
                    name: tm.name,
                    source_table: tm.source_table,
                    target_table: tm.target_table,
                    sys_id: tm.sys_id
                }))
            });
        }
        const totalSources = dataSources.reduce((sum, ds) => sum + ds.count, 0);
        return (0, error_handler_js_1.createSuccessResult)({
            discovered: true,
            data_sources: dataSources,
            summary: {
                total_sources: totalSources,
                types_found: dataSources.length,
                filter_applied: sourceType
            },
            message: `Discovered ${totalSources} data sources across ${dataSources.length} categories`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_data_sources.js.map