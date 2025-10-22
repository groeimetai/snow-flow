"use strict";
/**
 * snow_catalog_item_search - Search catalog items
 *
 * Search service catalog items with filtering options.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_catalog_item_search',
    description: 'Search service catalog items with filtering options',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'catalog',
    use_cases: ['catalog-search', 'service-catalog', 'discovery'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query (searches name and short_description)'
            },
            active_only: {
                type: 'boolean',
                description: 'Only return active catalog items',
                default: true
            },
            category: {
                type: 'string',
                description: 'Filter by category sys_id'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 20,
                minimum: 1,
                maximum: 100
            }
        }
    }
};
async function execute(args, context) {
    const { query, active_only = true, category, limit = 20 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        let searchQuery = '';
        if (query) {
            searchQuery = `nameLIKE${query}^ORshort_descriptionLIKE${query}`;
        }
        if (active_only) {
            searchQuery += searchQuery ? '^active=true' : 'active=true';
        }
        if (category) {
            searchQuery += searchQuery ? `^category=${category}` : `category=${category}`;
        }
        // Search catalog items
        const response = await client.get('/api/now/table/sc_cat_item', {
            params: {
                sysparm_query: searchQuery || undefined,
                sysparm_limit: limit
            }
        });
        const items = response.data.result || [];
        return (0, error_handler_js_1.createSuccessResult)({
            total_results: items.length,
            catalog_items: items.map((item) => ({
                sys_id: item.sys_id,
                name: item.name,
                short_description: item.short_description,
                active: item.active,
                category: item.category,
                price: item.price
            }))
        }, { query: query || 'all', limit, count: items.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_catalog_item_search.js.map