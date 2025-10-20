"use strict";
/**
 * snow_comprehensive_search - Search across multiple tables
 *
 * Comprehensive search across ServiceNow artifacts with
 * intelligent type detection and relevance scoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_comprehensive_search',
    description: 'Search across multiple tables for artifacts (widgets, pages, flows, scripts)',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query (searches name, title, description fields)'
            },
            types: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: ['widget', 'page', 'flow', 'script_include', 'business_rule', 'all']
                },
                description: 'Artifact types to search',
                default: ['all']
            },
            limit: {
                type: 'number',
                description: 'Maximum results per type',
                default: 10,
                minimum: 1,
                maximum: 100
            },
            include_inactive: {
                type: 'boolean',
                description: 'Include inactive/deleted artifacts',
                default: false
            }
        },
        required: ['query']
    }
};
const SEARCH_TABLES = {
    widget: { table: 'sp_widget', name_field: 'id', title_field: 'name' },
    page: { table: 'sys_ux_page', name_field: 'name', title_field: 'title' },
    flow: { table: 'sys_hub_flow', name_field: 'name' },
    script_include: { table: 'sys_script_include', name_field: 'name' },
    business_rule: { table: 'sys_script', name_field: 'name' }
};
async function execute(args, context) {
    const { query, types = ['all'], limit = 10, include_inactive = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Determine which tables to search
        const searchTypes = types.includes('all')
            ? Object.keys(SEARCH_TABLES)
            : types;
        const results = {
            query,
            found: [],
            total: 0
        };
        // Search each table
        for (const type of searchTypes) {
            const config = SEARCH_TABLES[type];
            if (!config)
                continue;
            // Build search query
            const searchFields = [config.name_field];
            if (config.title_field)
                searchFields.push(config.title_field);
            searchFields.push('description');
            const searchQuery = searchFields
                .map(field => `${field}LIKE${query}`)
                .join('^OR');
            const activeQuery = include_inactive ? '' : '^active=true';
            const fullQuery = searchQuery + activeQuery;
            // Execute search
            const response = await client.get(`/api/now/table/${config.table}`, {
                params: {
                    sysparm_query: fullQuery,
                    sysparm_limit: limit,
                    sysparm_fields: `sys_id,${searchFields.join(',')},sys_created_on,sys_updated_on`
                }
            });
            // Add results
            if (response.data.result.length > 0) {
                results.found.push({
                    type,
                    table: config.table,
                    count: response.data.result.length,
                    artifacts: response.data.result.map((r) => ({
                        sys_id: r.sys_id,
                        name: r[config.name_field],
                        title: config.title_field ? r[config.title_field] : undefined,
                        description: r.description,
                        created: r.sys_created_on,
                        updated: r.sys_updated_on
                    }))
                });
                results.total += response.data.result.length;
            }
        }
        return (0, error_handler_js_1.createSuccessResult)(results);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_comprehensive_search.js.map