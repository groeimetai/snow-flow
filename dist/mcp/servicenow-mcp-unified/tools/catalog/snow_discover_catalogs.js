"use strict";
/**
 * snow_discover_catalogs - Discover service catalogs
 *
 * Discovers available service catalogs and their categories in the ServiceNow instance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_catalogs',
    description: 'Discovers available service catalogs and their categories in the ServiceNow instance.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'service-catalog',
    use_cases: ['discovery', 'catalogs', 'categories'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            include_categories: { type: 'boolean', description: 'Include category tree', default: true },
            active_only: { type: 'boolean', description: 'Show only active catalogs', default: true }
        }
    }
};
async function execute(args, context) {
    const { include_categories = true, active_only = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const query = active_only ? 'active=true' : '';
        // Get catalogs
        const response = await client.get('/api/now/table/sc_catalog', {
            params: {
                sysparm_query: query,
                sysparm_limit: 50
            }
        });
        const catalogs = response.data.result;
        // Get categories for each catalog if requested
        let catalogsWithDetails = catalogs;
        if (include_categories) {
            catalogsWithDetails = await Promise.all(catalogs.map(async (catalog) => {
                const catResponse = await client.get('/api/now/table/sc_category', {
                    params: {
                        sysparm_query: `sc_catalog=${catalog.sys_id}`,
                        sysparm_limit: 20
                    }
                });
                return {
                    ...catalog,
                    categories: catResponse.data.result
                };
            }));
        }
        return (0, error_handler_js_1.createSuccessResult)({
            catalogs: catalogsWithDetails,
            count: catalogsWithDetails.length
        }, {
            operation: 'discover_catalogs',
            active_only,
            include_categories
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_catalogs.js.map