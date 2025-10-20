"use strict";
/**
 * snow_cmdb_search - Search CMDB
 *
 * Searches Configuration Management Database (CMDB) for configuration items with relationship mapping.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_cmdb_search',
    description: 'Searches Configuration Management Database (CMDB) for configuration items with relationship mapping',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query for configuration items (e.g., "server name", "application")'
            },
            ci_type: {
                type: 'string',
                description: 'Type of CI to search',
                enum: ['server', 'application', 'database', 'network_device', 'service', 'any'],
                default: 'any'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 10,
                minimum: 1,
                maximum: 100
            },
            include_relationships: {
                type: 'boolean',
                description: 'Include CI relationships',
                default: false
            }
        },
        required: ['query']
    }
};
// CI type to table mapping
const ciTableMapping = {
    server: 'cmdb_ci_server',
    application: 'cmdb_ci_application',
    database: 'cmdb_ci_database',
    network_device: 'cmdb_ci_network_device',
    service: 'cmdb_ci_service',
    any: 'cmdb_ci'
};
function processSearchQuery(query) {
    // If already a ServiceNow encoded query, return as-is
    if (query.includes('=') || query.includes('!=') || query.includes('^') || query.includes('LIKE')) {
        return query;
    }
    // Default: search in name and short_description
    return `nameLIKE${query}^ORshort_descriptionLIKE${query}`;
}
async function execute(args, context) {
    const { query, ci_type = 'any', limit = 10, include_relationships = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get the appropriate CI table
        const ciTable = ciTableMapping[ci_type] || 'cmdb_ci';
        // Process query
        const processedQuery = processSearchQuery(query);
        // Search CIs
        const response = await client.get(`/api/now/table/${ciTable}`, {
            params: {
                sysparm_query: processedQuery,
                sysparm_limit: limit
            }
        });
        const configItems = response.data.result || [];
        let result = {
            total_results: configItems.length,
            ci_type,
            table_searched: ciTable,
            query_used: processedQuery,
            configuration_items: configItems.map((ci) => ({
                sys_id: ci.sys_id,
                name: ci.name,
                short_description: ci.short_description,
                operational_status: ci.operational_status,
                support_group: ci.support_group,
                sys_class_name: ci.sys_class_name
            }))
        };
        // Include relationships if requested
        if (include_relationships && configItems.length > 0) {
            const relationships = [];
            for (const ci of configItems) {
                try {
                    const relResponse = await client.get('/api/now/table/cmdb_rel_ci', {
                        params: {
                            sysparm_query: `parent=${ci.sys_id}^ORchild=${ci.sys_id}`,
                            sysparm_limit: 20
                        }
                    });
                    if (relResponse.data.result && relResponse.data.result.length > 0) {
                        relationships.push({
                            ci_sys_id: ci.sys_id,
                            ci_name: ci.name,
                            relationship_count: relResponse.data.result.length,
                            relationships: relResponse.data.result.map((rel) => ({
                                type: rel.type,
                                parent: rel.parent?.name || rel.parent,
                                child: rel.child?.name || rel.child
                            }))
                        });
                    }
                }
                catch (error) {
                    // Log but don't fail the entire request
                    console.warn(`Failed to get relationships for CI ${ci.sys_id}:`, error);
                }
            }
            result.relationships = relationships;
        }
        return (0, error_handler_js_1.createSuccessResult)(result, { query: processedQuery, ci_type, limit, count: configItems.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_cmdb_search.js.map